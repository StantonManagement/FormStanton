# PBV-01 Documents Decoupling — Build Report
**Date:** 2026-05-14  
**Status:** Complete ✅ (all phases verified 2026-05-14)

---

## Objective
Decouple PBV documents from `form_submission_documents` into a new polymorphic `application_documents` table keyed by `(anchor_type, anchor_id)`. Full structural parity with live schema. No deletion of old rows. Submission-keyed code paths for non-PBV forms unchanged.

---

## Phase 1 — Table + Seeding

**Migration:** `supabase/migrations/20260514120000_application_documents.sql`
- New table `application_documents` with polymorphic anchor `(anchor_type TEXT, anchor_id UUID)`
- Full structural parity with live `form_submission_documents` — all live columns mirrored except `form_submission_id` replaced by anchor pair
- RLS enabled, `trigger_set_updated_at()` wired, indexes on `(anchor_type, anchor_id)`, `(assigned_to_user_id)`, `(status)`

**Deviation from live schema (intentional):**
- `approved_by_user_id` and `rejected_by_user_id` — absent from live `form_submission_documents`, not added to `application_documents`. Flagged for future consideration.

**Seeding:**  
- `lib/documents/seedFromTemplates.ts` — `seedDocumentsForApplication()` and `seedDocumentsForSubmission()` primitives
- `app/api/admin/applications/[anchor_type]/[anchor_id]/seed-documents/route.ts` — POST endpoint
- `lib/documents/__tests__/seedFromTemplates.test.ts` — unit tests covering expansion, idempotency, member filtering, error cases

---

## Phase 2 — Data Migration

**Migration:** `supabase/migrations/20260514130000_migrate_pbv_documents.sql`
- Copies all PBV `form_submission_documents` rows (via `pbv_full_applications.form_submission_id` join) into `application_documents`
- Idempotent via `_pbv_doc_id_map` staging table and `migrated_to_application_documents` marker column
- Drops FK constraint on `application_events.document_id`, backfills `document_id` to new `application_documents` IDs
- Fixed: `upload_source` column absent from live `form_submission_documents` — excluded from SELECT/INSERT lists

**Rollback:** `scripts/rollback-pbv-documents-migration.sql`

---

## Phase 3 — Write Paths

### New application-keyed routes (all at `/api/admin/applications/[anchor_type]/[anchor_id]/documents/...`)

| Route | Method | File |
|-------|--------|------|
| `[documentId]/approve` | POST | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/approve/route.ts` |
| `[documentId]/reject` | POST | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/reject/route.ts` |
| `[documentId]/waive` | POST | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/waive/route.ts` |
| `[documentId]/categorize` | POST | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/categorize/route.ts` |
| `[documentId]/assign` | PATCH | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/assign/route.ts` |
| `[documentId]/tier2` | POST | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/tier2/route.ts` |
| `upload` | POST | `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts` |

All routes: authenticated via `isAuthenticated`/`requireStantonStaff`, fetch from `application_documents` using `(anchor_type, anchor_id)`, write events via `writePbvApplicationEvent`, audit via `logAudit`. Packet lock enforced on all mutating routes.

Upload route: reads tenant metadata from `pbv_full_applications` directly (not `form_submissions`). Storage path: `form-submissions/{anchor_id}/{doc_type}/{filename}`.

Submission-keyed routes (`/api/admin/submissions/[submissionId]/documents/...`) **unchanged** — non-PBV form paths unaffected.

### Client updates

- `app/admin/pbv/full-applications/[id]/page.tsx` — `handleDocumentAction` retargeted: approve/reject/waive now call `/api/admin/applications/pbv_full_application/{id}/documents/{docId}/{action}`
- `components/review/StantonReviewSurface.tsx` — added `anchorType`/`anchorId` props; assign, claim, upload, recategorize URL construction uses anchor-keyed paths when props present, falls back to submission-keyed for non-PBV callers
- `components/review/UploadDialog.tsx` — `submissionId` prop replaced with `uploadUrl` (caller-constructed)
- `components/review/RecategorizeDialog.tsx` — `submissionId` prop replaced with `categorizeUrl` (caller-constructed)

---

## Phase 4 — Read Paths

All PBV document reads retargeted from `form_submission_documents` to `application_documents`:

| File | Change |
|------|--------|
| `app/api/admin/pbv/full-applications/[id]/route.ts` (GET) | Documents query retargeted; added `assigned_to_user_id`, `assigned_at`, `owner_review_status`, `owner_flag_reason` to select |
| `app/api/admin/pbv/full-applications/[id]/preflight/route.ts` | Preflight doc read retargeted |
| `app/api/admin/pbv/full-applications/[id]/export/route.ts` | Export doc read retargeted |
| `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts` | Pre-flight check doc read retargeted |
| `app/api/admin/pbv/full-applications/[id]/hha/route.ts` | Required-docs check retargeted |
| `app/api/admin/pbv/full-applications/route.ts` | `enrichWithAssignees` and `assigned_to_me` filter retargeted; now keyed by `anchor_id` |
| `app/api/admin/pbv/pipeline/route.ts` | Batch doc status counts retargeted; keyed by `anchor_id` |

**Intentionally unchanged:**
- `app/api/admin/pbv/full-applications/[id]/token/route.ts` — queries `form_submission_documents` to guard pre-intake token regeneration. See "Token Guard" section below for full analysis.
- `components/review/PriorVersionsExpander.tsx` — still submission-keyed. Revision history lives in `form_submission_document_revisions`, out of scope for PRD-01. See PRD-1.5.

---

## Phase 3 Cleanup (post-review)

### Bulk-Assign Migration

New route: `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/bulk-assign/route.ts`
- Accepts `document_ids[]` + `user_id`
- Fetches and validates docs from `application_documents` (enforces anchor ownership)
- Updates `assigned_to_user_id / assigned_at / assigned_by_user_id`
- Writes `DOC_ASSIGNED` event per doc
- Posts one summary workspace message
- Audit-logged via `logAudit`

`StantonReviewSurface.tsx` `handleBulkAssign` updated to call `/api/admin/applications/${anchorType}/${anchorId}/documents/bulk-assign`.

### Fallback Elimination

`StantonReviewSurface` `anchorType` and `anchorId` promoted from optional to **required** props. All ternary fallback branches (`anchorType && anchorId ? new_url : submission_url`) removed. `StantonReviewSurface` is now application-anchored only — no submission-keyed fallback path exists.

---

## Token Guard — Full Analysis

**File:** `app/api/admin/pbv/full-applications/[id]/token/route.ts`  
**Query at line ~53:** `form_submission_documents WHERE form_submission_id = X AND revision > 0`

**Tenant upload path confirmed:** `app/api/t/[token]/documents/[documentId]/route.ts` resolves the token via `form_submissions` table, fetches the document slot from `form_submission_documents`, and writes the upload back to `form_submission_documents`. It also inserts into `form_submission_document_revisions`. **This path writes to `form_submission_documents`, not `application_documents`.**

**Verdict:** The token guard is correct. Tenant uploads still target `form_submission_documents`, so checking revision count there accurately reflects whether the tenant has uploaded anything. This is not a latent bug.

**Dependency:** Correctness depends on the tenant upload path remaining submission-keyed. When PRD-02 migrates the tenant upload path to `application_documents`, the guard must be retargeted to: `application_documents WHERE anchor_type = 'pbv_full_application' AND anchor_id = <id> AND revision > 0`. The guard is annotated with this migration instruction in code.

---

## Verification

### TypeScript

`tsc --noEmit` — zero new type errors introduced. All pre-existing errors are in test files (`@testing-library/react` missing types, mock signature mismatches).

### Submission-keyed grep (PBV scope)

```
Get-ChildItem -Path app\api\admin\pbv,app\admin\pbv -Recurse -Include *.ts,*.tsx |
  Select-String -Pattern form_submission_documents | Select-Object Path, LineNumber, Line
```

Results after cleanup:
- `token/route.ts:53` — intentional pre-intake guard (see Token Guard section)
- `pipeline/route.ts:153` — code comment only, not a query

All PBV document read and write paths use `application_documents`.

### Phase 2 DB Verification Results (run against `lieeeqqvshobnqofcdac` 2026-05-14)

| Check | Expected | Result | Pass |
|-------|----------|--------|------|
| Row count: `application_documents` (anchor_type=pbv_full_application) vs PBV rows in `form_submission_documents` | Equal | **34 = 34** | ✓ |
| Idempotency: PBV source rows not yet in `application_documents` | 0 | **0** | ✓ |
| `application_events.document_id IS NULL` for doc_ events | 0 | **0** | ✓ |
| Column spot-check: `doc_type`, `label`, `status` match across tables | All equal | **Verified — 10/10 rows match** | ✓ |

---

## Phase 5 — Verification Sign-Off (2026-05-14)

| Check | Result |
|-------|--------|
| Row count: `application_documents` (pbv) = `_migration_pbv_documents_map` = FSD marked | **34 = 34 = 34** ✓ |
| `application_events.document_id` unresolved (pbv-anchored) | **0** ✓ |
| `application_events.document_id` pointing to FSD-only IDs (not in AD) | **0** ✓ |
| Document-state distribution | approved:9, missing:16, rejected:2, submitted:6, waived:1 ✓ |
| PBV read paths grep: `form_submission_documents` in `app/api/admin/pbv`, `app/admin/pbv` | `token/route.ts:53` (intentional guard) + `pipeline/route.ts:153` (comment only) ✓ |
| `form_document_templates` for `pbv-full-application` | 33 template rows ✓ |
| TypeScript (`tsc --noEmit`) | Zero new errors (pre-existing test-file errors only) ✓ |

**PRD-01 declared closed.**

---

## Known Gaps / Next Steps

1. **`token/route.ts` guard** — correct now; retarget when PRD-02 migrates the tenant upload path.
2. **`approved_by_user_id` / `rejected_by_user_id`** — absent from live schema, not added. Revisit if needed.
