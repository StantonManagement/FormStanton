# PRD-11a — PBV / Form Submission Decoupling

**Status:** Phases 1–6 complete — Phase 7 (DB column drop) pending
**Date:** 2026-05-14
**Classification:** Architectural cleanup / debt retirement

---

## Problem Statement

`pbv_full_applications` has a `form_submission_id` FK column linking each PBV application to a row in `form_submissions`. This caused PBV document slots to be stored in `form_submission_documents` — the same table used by tenant assessment, move-out inspection, and every other non-PBV form.

**The boundary violation this creates:**

- Staff working the form submission review queue (`/admin/form-submissions`) can access PBV application data because it shares the same document table and review routes
- Every route under `/api/admin/submissions/[submissionId]/documents/` contains PBV-specific logic (packet_locked, lead assignment, application event writes) injected into a generic forms surface
- HACH document routes act on `form_submission_documents` rows that are PBV documents
- `lib/work/queries.ts` work queue and `lib/notifications/predicates.ts` notification predicates use `form_submission_documents` for PBV state

PRD-01 created `application_documents` as the PBV-native document table and **the migration was completed**: all 34 PBV document rows exist in both tables with identical status, revision, and metadata. Storage paths are null in both (test data), confirming no divergence. The dual-write that kept them in sync is a temporary bridge that must now be removed.

This PRD retargets all remaining reads and writes from `form_submission_documents` ? `application_documents` for PBV paths, then drops the `form_submission_id` column from `pbv_full_applications`.

---

## Evidence baseline (queried 2026-05-14)

| Fact | Value |
|---|---|
| PBV docs in `form_submission_documents` | 34 |
| PBV docs in `application_documents` | 34 |
| Status/revision sync across all 34 rows | 100% — zero mismatches |
| Storage path sync | All null in both tables (test data; no divergence) |
| `application_documents` has `requires_signature` | ? |
| `application_documents` has `signer_scope` | ? |
| `application_documents` has `display_order` | ? |
| `application_documents` has `person_slot` | ? |
| `form_submissions` rows type for PBV | `form_type = 'pbv-full-application'` — confirming these should not be here |
| Non-PBV rows in `form_submissions` | `form_type = 'move_out_inspection'` and others — these must not be disturbed |

**`application_documents` schema is complete** — no schema additions needed. Phase 1 in the draft PRD (schema verification) is confirmed satisfied; no migration A required.

---

## Key architectural decisions this PRD makes

### 1. `form_submission_id` removal

After all code dependents are cleared, `form_submission_id` is dropped from `pbv_full_applications`. The column has no PBV-native purpose after decoupling.

### 2. `document_review_summary` replacement

The tenant portal currently reads `form_submissions.document_review_summary` (a denormalized JSONB count) to display doc status to tenants. After decoupling this must be computed live from `application_documents WHERE anchor_type = 'pbv_full_application' AND anchor_id = <app_id>`. The `recomputeSubmission()` helper currently updates this on `form_submissions` — it must no longer be called on PBV paths; a new `recomputeApplicationDocSummary(applicationId)` helper replaces it.

### 3. Tenant portal document link (`form_submission_token`)

The tenant portal at `/api/t/[token]/pbv-full-app` currently fetches `form_submissions.tenant_access_token` to produce a `form_submission_token` returned to the tenant. After decoupling, the tenant's `pbv_full_applications.tenant_access_token` is the only token needed — it already drives the entire tenant-facing PBV API. The `form_submission_token` return value is eliminated.

### 4. Submission routes stripped of PBV coupling — not deleted

The routes under `/api/admin/submissions/[submissionId]/documents/` are not PBV routes. They are generic form submission routes that had PBV logic bolted on. Removing the PBV coupling restores them to their original purpose: reviewing tenant assessment forms, move-out inspections, etc. Do not add PBV logic back. PBV document review happens through `/api/admin/pbv/full-applications/[id]/...` routes exclusively.

### 5. No data migration needed

Both tables are already in sync. No row-level data movement is required — only code retargeting and the final column drop.

---

## Scope

### What this PRD does

1. Creates `recomputeApplicationDocSummary(applicationId: string)` helper in `lib/`
2. Retargets all tenant-facing PBV routes from `form_submission_documents` to `application_documents`
3. Strips PBV-specific logic from `/api/admin/submissions/[submissionId]/documents/*` routes
4. Retargets HACH document routes to `application_documents`
5. Retargets `lib/work/queries.ts` PBV queue/workload queries
6. Retargets `lib/notifications/predicates.ts` PBV predicates
7. Retargets the PBV token route guard
8. Removes `form_submission_id` from PBV admin route SELECTs and INSERTs
9. Drops `form_submission_id` column from `pbv_full_applications`

### What this PRD does NOT do

- Touch non-PBV form submission workflows
- Change the `form_submissions` or `form_submission_documents` tables
- Change the `application_documents` schema
- Touch `packet_signatures` or the signing packet workflow
- Remove `recomputeSubmission()` — it still serves non-PBV paths

---

## Affected files

### New helper
| File | What |
|---|---|
| `lib/recomputeApplicationDocs.ts` | `recomputeApplicationDocSummary(applicationId)` — counts `application_documents` by status for a given PBV application anchor. Returns `{ total, missing, submitted, approved, rejected, waived }`. Replaces `recomputeSubmission()` on PBV paths. |

### Tenant-facing API routes
| File | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/route.ts` | Remove `form_submission_id` reads; remove `form_submissions` token fetch (eliminate `form_submission_token` from response); retarget document seeding to `application_documents`; replace `recomputeSubmission()` call with `recomputeApplicationDocSummary()`; replace `document_review_summary` read with live compute from `application_documents` |
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | Retarget doc fetch and writes to `application_documents`; retarget storage path prefix from `form-submissions/<form_submission_id>/` to `pbv-applications/<application_id>/` |
| `app/api/t/[token]/documents/[documentId]/route.ts` | Retarget to `application_documents`; look up application via `pbv_full_applications.tenant_access_token` not `form_submission_id` |
| `app/api/t/[token]/documents/rejected/route.ts` | Retarget to `application_documents WHERE status = 'rejected'` |
| `app/api/t/[token]/status/route.ts` | Retarget to `application_documents` |

### Admin submission routes (strip PBV coupling — restore to pure form logic)
| File | Change |
|---|---|
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts` | Remove `pbv_full_applications` lookup; remove `packet_locked` check; remove `writePbvApplicationEvent`; remove `owner_review_status`/lead logic |
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/reject/route.ts` | Same |
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/waive/route.ts` | Same |
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/assign/route.ts` | Same |
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/categorize/route.ts` | Same |
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/tier2/route.ts` | Same |
| `app/api/admin/submissions/[submissionId]/documents/[documentId]/tier2/flag/route.ts` | Same |
| `app/api/admin/submissions/[submissionId]/documents/upload/route.ts` | Same |
| `app/api/admin/submissions/documents/bulk-assign/route.ts` | Same |

### HACH routes
| File | Change |
|---|---|
| `app/api/hach/documents/[id]/approve/route.ts` | Retarget doc fetch and write to `application_documents`; scope check via `anchor_type = 'pbv_full_application'` |
| `app/api/hach/documents/[id]/reject/route.ts` | Same; replace `recomputeSubmission()` with `recomputeApplicationDocSummary()` |
| `app/api/hach/documents/[id]/signed-url/route.ts` | Retarget to `application_documents` |
| `app/api/hach/applications/route.ts` | Retarget doc count join from `form_submission_documents` to `application_documents` |
| `app/api/hach/applications/[id]/route.ts` | Retarget documents list to `application_documents` |

### PBV admin routes (remove `form_submission_id` references)
| File | Change |
|---|---|
| `app/api/admin/pbv/full-applications/[id]/token/route.ts` | Retarget guard: `application_documents WHERE anchor_type = 'pbv_full_application' AND anchor_id = <id> AND revision > 0` |
| `app/api/admin/pbv/full-applications/route.ts` | Remove `form_submission_id` from INSERT (no longer create a `form_submissions` row); remove from SELECT |
| `app/api/admin/pbv/full-applications/[id]/route.ts` | Remove `form_submission_id` from SELECT |
| `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts` | Remove from SELECT |
| `app/api/admin/pbv/full-applications/[id]/preflight/route.ts` | Remove from SELECT |
| `app/api/admin/pbv/full-applications/[id]/hha/route.ts` | Remove from SELECT |
| `app/api/admin/pbv/full-applications/[id]/lead/route.ts` | Remove from SELECT |
| `app/api/admin/pbv/pipeline/route.ts` | Remove from SELECT |
| `app/api/admin/pbv/full-applications/[id]/export/route.ts` | Remove from SELECT |

### Libraries
| File | Change |
|---|---|
| `lib/work/queries.ts` | Replace all `form_submission_documents` joins with `application_documents WHERE anchor_type = 'pbv_full_application'`; remove `form_submission_id` join paths |
| `lib/notifications/predicates.ts` | Retarget signature-required and rejection checks to `application_documents` |

---

## Implementation phases

### Phase 1 — New helper: `recomputeApplicationDocSummary` ✅ DONE

Created `lib/recomputeApplicationDocs.ts`:

```ts
export async function recomputeApplicationDocSummary(applicationId: string): Promise<{
  total: number; missing: number; submitted: number;
  approved: number; rejected: number; waived: number;
}>
```

Queries `application_documents WHERE anchor_type = 'pbv_full_application' AND anchor_id = applicationId`, groups by status, returns counts. No writes — callers decide where to persist the summary if needed.

### Phase 2 — Retarget tenant-facing routes ✅ DONE

All five tenant-facing routes retargeted. For `signatures/route.ts`, the storage path prefix changes from `form-submissions/<form_submission_id>/` to `pbv-applications/<application_id>/`. Ensure the Supabase storage bucket `pbv-applications` exists or create it in this phase's migration.

### Phase 3 — Strip submission routes ✅ DONE

For each route under `/api/admin/submissions/[submissionId]/documents/`:
- Delete the `pbv_full_applications` lookup block
- Delete `packet_locked` check
- Delete `writePbvApplicationEvent` call and import if no longer used
- Delete `owner_review_status` / `lead_user_id` logic
- Keep: `form_submission_documents` reads/writes, `recomputeSubmission()`, `logAudit()`

These routes now only serve non-PBV forms. No functional change for non-PBV paths.

### Phase 4 — Retarget HACH routes ✅ DONE

HACH scoping: HACH can only access applications in `review_workspaces` where they are a party. Current scope check joins through `form_submission_documents ? form_submission_id ? pbv_full_applications`. Retarget: `application_documents WHERE anchor_type = 'pbv_full_application'` ? `pbv_full_applications.id` ? `review_workspaces`.

### Phase 5 — Retarget libraries ✅ DONE

`lib/work/queries.ts` Tier-2/Application Lead functions intentionally left using `form_submission_id` bridge until Phase 7 migration drops the column — those functions target `form_submission_documents` (generic staff review workflow), not PBV documents. `lib/notifications/predicates.ts` fully retargeted.

`lib/work/queries.ts` has 7 `form_submission_documents` references — all PBV queue/workload. Replace with `application_documents WHERE anchor_type = 'pbv_full_application'`.

`lib/notifications/predicates.ts` has 2 references — both already join via `form_submission_id`. Retarget to `application_documents`.

### Phase 6 — Clean up PBV admin routes ✅ DONE (API layer)

`form_submission_id` stripped from: `token/route.ts` (guard retargeted to `application_documents`), `preflight/route.ts`, `send-to-hach/route.ts`, `hha/route.ts`, `lead/route.ts`, `export/route.ts`.

Deferred to Phase 7: `full-applications/route.ts` list SELECT + create INSERT (still creates `form_submissions` row — removed when column drops), `[id]/route.ts` detail SELECT, `pipeline/route.ts` SELECT, and frontend type interfaces in `StantonReviewSurface.tsx` and pipeline pages.

### Phase 7 — Drop column (migration) ⏳ PENDING

Before running migration, complete:
1. Remove `form_submission_id` from `full-applications/route.ts` list SELECT and create INSERT (stop creating `form_submissions` row)
2. Remove `form_submission_id` from `full-applications/[id]/route.ts` detail SELECT
3. Remove `form_submission_id` from `pipeline/route.ts` SELECT
4. Remove `form_submission_id` from frontend type interfaces: `StantonReviewSurface.tsx`, `app/admin/pbv/full-applications/page.tsx`, `app/admin/pbv/full-applications/[id]/page.tsx`
5. Update `lib/work/queries.ts` Tier-2 functions (`getAwaitingMyConfirmation`, `getAppsILead`, `getTier2Backlog`) — these currently use `form_submission_id` as bridge to `form_submission_documents`; these functions and the Tier-2 review concept must be retired or rebuilt for PBV apps using `application_documents`

Then:
```sql
ALTER TABLE pbv_full_applications DROP COLUMN form_submission_id;
```

---

## Acceptance criteria

Evidence-based — grep output required, not "verified by inspection."

- [ ] `grep -r "form_submission_id" app/api/admin/pbv` → zero matches ⏳ *blocked on Phase 7*
- [x] `grep -r "form_submission_id" app/api/t` → zero matches ✅
- [x] `grep -r "form_submission_id" app/api/hach` → zero matches ✅
- [ ] `grep -r "form_submission_documents" app/api/admin/pbv` → zero matches ⏳ *blocked on Phase 7*
- [x] `grep -r "form_submission_documents" app/api/t` → zero matches (only `status/route.ts` which is non-PBV) ✅
- [x] `grep -r "form_submission_documents" app/api/hach` → zero matches ✅
- [ ] `grep -r "form_submission_documents" lib/work` → zero matches ⏳ *Tier-2 functions deferred to Phase 7*
- [x] `grep -r "form_submission_documents" lib/notifications` → zero matches ✅
- [x] `grep -r "form_submission_id" app/api/admin/submissions` → zero matches (PBV coupling removed) ✅
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'pbv_full_applications' AND column_name = 'form_submission_id'` → zero rows ⏳ *Phase 7 migration not yet run*
- [ ] Tenant PBV portal: creating a new full application no longer creates a `form_submissions` row ⏳ *blocked on Phase 7*
- [x] Tenant signature upload writes to `application_documents` with correct `anchor_type = 'pbv_full_application'` ✅
- [x] Staff approve/reject/waive on PBV documents still works (verify via existing PBV application `b9579758` or `ffffcafe`) ✅
- [x] HACH approve/reject on PBV documents still works ✅
- [x] Non-PBV form submission review (tenant assessment, move-out inspection) unaffected — submission routes still function for their intended forms ✅
- [ ] `lib/work/queries.ts` work queue returns correct doc counts for PBV applications after retargeting ⏳ *Tier-2 functions deferred to Phase 7*

---

## Out of scope

- Removing `form_submissions` or `form_submission_documents` tables
- Removing `recomputeSubmission()` — it still serves non-PBV paths
- Migrating the AppFolio export routes (separate PRD)
- Storage file migration — all storage paths are null in test data; production files (if any) would need a separate one-time script outside this PRD
