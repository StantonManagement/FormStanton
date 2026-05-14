# Windsurf Prompt — Stanton Workspace — Document Lifecycle

**PRD:** `docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md` (read end-to-end before writing any code)
**Build report (you create this):** `docs/build-reports/stanton-workspace-document-lifecycle_build-report_2026-05-13.md`
**Depends on:** `unified-review-surface` AND `review-workspace-schema` (both merged). If `components/review/StantonReviewSurface.tsx`, the workspace tables, or the workspace API routes are missing, **STOP and report**.
**Blocks:** `per-document-assignment` (PRD II), `workforce-dashboards` (PRD III), `post-approval-execution` (PRD IV)

---

## Execution mode

**Use the goal skill.** Execute Phase 1 and Phase 2 end-to-end without asking Alex to confirm between them. Auto-proceed from Phase 1 to Phase 2 once Phase 1's verification gates pass. **Stop only if:** a verification gate fails, a Hard NO is hit, a Required-reading file is missing, or you encounter ambiguity not resolved by the PRD.

When you stop, write a short summary of *what specifically failed* and *what you need from Alex*, and wait. Do not retry blindly.

---

## Context

You are building the document lifecycle for the Stanton Workspace — the substrate that everything else in the four-PRD initiative reads from. Today the workspace pane lets reviewers act on tenant-uploaded documents but is missing three load-bearing pieces:

1. **No staff document upload.** PMs can't upload on behalf of tenants or HACH.
2. **No Send-to-HACH handoff.** `hach_review_status` is set by nobody in the Stanton flow.
3. **No canonical event timeline.** `pbv_access_log` covers security events; nothing covers workflow events.

You are introducing the `application_events` table as the canonical workflow timeline, adding staff upload + provenance + versioning + re-categorize, and adding the role-gated Send-to-HACH action with hard packet lock and reopen.

---

## Generalization rule (binding)

Alex's standing rule: **data layer generalizes across workflows (PBV, refi, future); UI layer stays workflow-specific.** The `review-workspace-schema` migration already follows this — workspace tables are workflow-generic, the PBV-specific shape lives in API logic and seeds.

This prompt overrides the PRD's data-model in exactly one place: `application_events` uses a **polymorphic anchor**, not a hard FK to `pbv_full_applications`.

**Schema override (applies to Step 1 migration and everywhere the table is referenced):**

Replace the PRD's:
```sql
application_id UUID NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
```

With:
```sql
anchor_type TEXT NOT NULL CHECK (anchor_type IN ('pbv_full_application')),
anchor_id   UUID NOT NULL,
```

No FK to the anchor table. Referential integrity is enforced at the application layer via a resolver helper (see Step 2). The CHECK constraint enumerates the known anchor types — refi adds `'refi_application'` later via a one-line migration.

Replace the index `idx_application_events_app` with:
```sql
CREATE INDEX idx_application_events_anchor
  ON public.application_events (anchor_type, anchor_id, created_at DESC);
```

All other indexes from the PRD (by type, by document, by actor) stay as-written.

**UI terminology stays PBV-specific.** Buttons say "Send to HACH" not "Submit for partner review." The lock banner says "Packet locked." The reopen dialog references HACH. PBV-side users see PBV vocabulary. Refi UI, when it exists, will use refi vocabulary (lender / title / escrow). There is no generic UI shared between workflows — the schema is generic, the surfaces are not.

---

## Required reading before you start

1. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — every section.
2. **`docs/unified-review-surface_prd_2026-05-12.md`** — the surface you're extending.
3. **`docs/review-workspace-schema_prd_2026-05-12.md`** — the workspace channels you'll be posting system messages to.
4. **`app/admin/pbv/full-applications/[id]/page.tsx`** — the page you'll extend (Send-to-HACH button + lock banner + reopen).
5. **`components/review/StantonReviewSurface.tsx`** — the review surface that gains per-row Upload + Re-categorize buttons.
6. **`components/review/DocumentRow.tsx`** — provenance badge addition.
7. **`app/api/admin/pbv/full-applications/[id]/route.ts`** — the existing PATCH endpoint; you'll add lock-aware behavior.
8. **`app/api/admin/pbv/full-applications/[id]/hha/route.ts` and `…/export/route.ts`** — existing actions; both gain lock checks.
9. **`app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts`** (and `reject`, `waive` siblings) — gain lock checks and event writes.
10. **`supabase/migrations/20260423210000_pbv_full_application_tables.sql`** — schema of `pbv_full_applications`.
11. **`supabase/migrations/20260424163000_hach_reviewer_portal_schema.sql`** — `hach_review_status` definition.
12. **`supabase/migrations/20260512130000_review_workspace_schema.sql`** — workspace tables and channel constraints.
13. **`lib/auth.ts`** — permission walk (`permissions` / `role_permissions` / `user_roles` pattern).
14. **`lib/hach/payload-filter.ts`** — allowlist you'll need to extend for the HACH revision badge.
15. **`app/pbv-full-app/[token]/...`** — the tenant portal pages that need provenance labels.

---

## Build

### Phase 1 — Documents

**Step 1 — Migration**

Create `supabase/migrations/20260513XXXXXX_document_lifecycle.sql` with:
- Provenance fields on `form_submission_documents` (`uploaded_by_user_id`, `uploader_role`, `upload_source`, `upload_note`) per the PRD's data model.
- Backfill: set `upload_source='portal'` for existing rows where `uploader_role='tenant'` and `storage_path IS NOT NULL`.
- New table `application_events` with the schema and indexes from the PRD.
- Indexes on `form_submission_documents (uploaded_by_user_id, created_at DESC)` and `(uploader_role)`.

Do NOT add the Phase 2 columns (`submitted_to_hach_at`, `submitted_to_hach_by`, `hach_packet_revision`, `packet_locked`) in this migration. They land in Phase 2's migration. Two migrations, two reviewable diffs.

**Step 2 — Events helper**

Create `lib/events/application-events.ts`:
- Typed function `writeApplicationEvent(tx, { anchor_type, anchor_id, event_type, actor_user_id, actor_role, document_id?, metadata? })`.
  - `anchor_type` is a string-literal union: `'pbv_full_application'` for v1. New anchor types added by extending the union AND the DB CHECK constraint in the same migration.
  - For ergonomics, provide a thin wrapper `writePbvApplicationEvent(tx, { application_id, ...rest })` that calls `writeApplicationEvent` with `anchor_type: 'pbv_full_application'` and `anchor_id: application_id`. PBV route handlers call the wrapper; they don't see the anchor pattern directly. This keeps call sites readable while preserving the generic substrate.
- **Required:** all writes happen inside an active transaction passed in. The helper throws if called without one. This protects against silent partial state — the event write and the state mutation must commit together or neither.
- Typed event-type enum exporting the v1 set: `doc_uploaded`, `doc_approved`, `doc_rejected`, `doc_waived`, `doc_recategorized`, `doc_superseded`, `submitted_to_hach`, `hach_packet_revised`, `packet_reopened`.
- Also create `lib/events/anchor.ts` exporting `resolveAnchor(anchor_type, anchor_id)` — returns the anchor row from whichever table the type maps to (`pbv_full_applications` for v1). Used by any read path that needs to render or audit events without knowing the anchor table up front. Throws on unknown anchor type.

**Step 3 — Staff upload**

Create `app/api/admin/submissions/[submissionId]/documents/upload/route.ts`:
- Multipart form: `file`, `doc_type`, `person_slot`, `source`, `note?`.
- Validates `source` against the dropdown values.
- Resolves the slot's current max revision; new row's `revision = max + 1` (or 1 if first).
- Uploads file to `form-submissions` bucket using existing path convention.
- Creates the `form_submission_documents` row with `uploader_role='staff'`, `status='submitted'`, provenance fields populated.
- Writes `doc_uploaded` event in the same transaction.
- If a prior revision existed for the same slot, also writes `doc_superseded` event for that row (the prior row's status is unchanged; only the active-version computation changes).

Build `components/review/UploadDialog.tsx`:
- File picker, source dropdown, note textarea, submit.
- Category pre-filled from the row context.
- Disabled / hidden if `packet_locked` (Phase 2 wiring; in Phase 1 this is always false).

Wire the per-row Upload button into `components/review/DocumentRow.tsx` and `components/review/StantonReviewSurface.tsx`.

**Step 4 — Re-categorize**

Create `app/api/admin/submissions/[submissionId]/documents/[documentId]/categorize/route.ts`:
- Body: `{ doc_type, person_slot }`.
- Updates the document row; writes `doc_recategorized` event with old + new categorization.
- Does NOT delete or auto-supersede if target slot has active docs; both remain (the active-version rule is per-row, the slot rule is "≥1 approved/waived to fulfill").

Build `components/review/RecategorizeDialog.tsx` (category picker, person-slot picker, submit).

**Step 5 — Versioning UI**

Build `components/review/PriorVersionsExpander.tsx`:
- Renders inline below a document row when expanded.
- Lists prior revisions (older than the active revision) with file name, upload date, uploader, status, and any rejection reason.
- Each prior revision has a "View" affordance opening the existing DocumentViewer.

Modify `components/review/StantonReviewSurface.tsx` to compute active version per slot (max revision) and render the expander when there are prior revisions.

**Step 6 — Provenance badge on rows**

Modify `components/review/DocumentRow.tsx`:
- When `uploader_role !== 'tenant'`, render a small badge: `Uploaded by {display name} · {source label} · {date}`.
- When `uploader_role === 'tenant'`, no badge (consistent with existing behavior).

**Step 7 — Tenant portal labels**

Modify `app/pbv-full-app/[token]/...` (locate the document list component):
- For each slot, show the active version with provenance label:
  - `uploader_role='staff'` → "Uploaded by Stanton on your behalf"
  - `uploader_role='hach'` → "Provided by HACH"
- Slots with a non-tenant active doc show as "Received." Do not prompt the tenant to upload.
- Tenant does NOT see the prior-versions expander.

**Step 8 — Events on existing review actions**

Modify `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts`, `reject/route.ts`, `waive/route.ts`:
- Wrap existing logic in a transaction.
- Add `writeApplicationEvent` call inside the same transaction for `doc_approved` / `doc_rejected` / `doc_waived`.
- `document_review_actions` writes remain untouched.

**Step 9 — Phase 1 tests**

Create `__tests__/document-lifecycle-phase1.test.ts`:
1. Staff upload creates a row with correct provenance, increments revision when slot has prior docs.
2. Re-categorize moves a doc; conflict leaves siblings; event written with old/new metadata.
3. Approve / reject / waive each write to both `document_review_actions` (existing) AND `application_events` (new), atomically.
4. Tenant upload still works; new rows have `uploader_role='tenant'`, `upload_source='portal'`.
5. Prior versions never delete: upload v2 → both v1 and v2 rows exist in DB.
6. Tenant portal hides provenance internals (no admin user IDs in tenant responses).
7. HACH payload-filter still passes (no Stanton provenance leaks via HACH endpoints).

**Step 10 — Phase 1 verification gates**

Run before proceeding to Phase 2:
- `npm run build` — zero errors.
- `npm test` — all green, including new and pre-existing.
- TypeScript strict — clean.
- Manual: upload a doc as staff, verify it appears in review with provenance badge.
- Manual: re-categorize a doc; verify both originals show in the target slot.
- Manual: tenant magic link shows the staff-uploaded doc with "Uploaded by Stanton on your behalf."

If all gates pass, **auto-proceed to Phase 2.** No confirmation needed.

---

### Phase 2 — Handoff

**Step 11 — Migration**

Create `supabase/migrations/20260513XXXXXX_handoff.sql`:
- Adds `submitted_to_hach_at`, `submitted_to_hach_by`, `hach_packet_revision`, `packet_locked` to `pbv_full_applications` per the PRD's data model.
- Seeds the new permission: `INSERT INTO permissions (resource, action) VALUES ('pbv-full-applications', 'send_to_hach') ON CONFLICT DO NOTHING`.
- Index on `submitted_to_hach_at DESC NULLS LAST`.

**Step 12 — Pre-flight endpoint**

Create `app/api/admin/pbv/full-applications/[id]/preflight/route.ts`:
- GET. Returns `{ checks: [...], packet_summary: {...}, permission_held: bool }`.
- Checks: all required docs approved/waived; `stanton_review_status='approved'`; `hha_application_file` non-null.
- Note: leave a clear extension point comment for the tier-2 check from PRD II — it will be added there, not here.

**Step 13 — Send-to-HACH endpoint**

Create `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`:
- POST. Auth: `isAuthenticated` + permission `pbv-full-applications:send_to_hach`.
- Body: `{ override_reason?, override_failed_checks? }`.
- Re-runs preflight inside a transaction. If failed checks but no override, return 422 with the failed checks.
- If override, the route requires `override_reason` (validate non-empty).
- Atomically (same transaction):
  - `submitted_to_hach_at = NOW()`, `submitted_to_hach_by = current user`
  - `hach_packet_revision = hach_packet_revision + 1`
  - `packet_locked = TRUE`
  - `hach_review_status = 'pending_hach'`
  - Write `submitted_to_hach` event (or `hach_packet_revised` if revision > 1) with override info in metadata.
  - Post system-authored message to `shared_workspace_messages` (`author_user_id = NULL`, `author_display = 'System'`, `author_party_org = 'stanton'`): "Stanton submitted this packet to HACH on [date]. Revision N."

**Step 14 — Reopen endpoint**

Create `app/api/admin/pbv/full-applications/[id]/reopen/route.ts`:
- POST. Auth: same permission as Send-to-HACH.
- Body: `{ reason: string }` (required, validate non-empty).
- Atomically:
  - `packet_locked = FALSE`
  - `hach_review_status = NULL`
  - Do NOT reset `submitted_to_hach_at`, `submitted_to_hach_by`, or `hach_packet_revision` — they preserve the most recent submission.
  - Write `packet_reopened` event with reason.
  - Post system-authored shared workspace message: "Stanton reopened this packet on [date]. Reason: [reason]."

**Step 15 — Lock enforcement on every Stanton write path**

Modify each of these to check `packet_locked` and return 423 Locked if true:
- `app/api/admin/submissions/[submissionId]/documents/upload/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/categorize/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/reject/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/waive/route.ts`
- `app/api/admin/pbv/full-applications/[id]/hha/route.ts`
- `app/api/admin/pbv/full-applications/[id]/route.ts` (PATCH — block mutations to `stanton_review_status`, income editor, etc.)

Each check resolves the application via the doc → submission → app chain. Lookup is one extra query; acceptable.

Also modify tenant-portal upload routes to check `packet_locked`; reject with a tenant-friendly message ("This packet is currently under HACH review. Contact the Stanton office if you have a new document.").

**Step 16 — UI: Send-to-HACH and Reopen**

In `app/admin/pbv/full-applications/[id]/page.tsx`:
- Fetch `permission_held` on page load.
- In the Actions section, render the **Send to HACH** button when:
  - User has the permission
  - `packet_locked = FALSE`
- Render the **Reopen Packet** button when:
  - User has the permission
  - `packet_locked = TRUE`
- For users without permission, render small explanatory text where the button would be: "Send to HACH requires elevated permissions."

Build `components/review/SendToHachDialog.tsx`:
- Calls preflight on open.
- Renders packet summary (counts by status, HHA filename, income, last reviewer).
- If failed checks: shows each with checkbox + required override reason textarea.
- "Confirm — Send to HACH" / "Cancel."

Build `components/review/ReopenPacketDialog.tsx`:
- Warning text about HACH review pause.
- Required reason field.
- "Confirm Reopen" / "Cancel."

**Step 17 — Lock banner**

Build `components/review/PacketLockBanner.tsx`:
- Renders at the top of `app/admin/pbv/full-applications/[id]/page.tsx` when `packet_locked = TRUE`.
- Shows: "This packet is locked. Submitted to HACH on [date] by [name]. Revision [N]. Reopen to make changes."
- The Reopen button is the only write-action available while locked.

Also: visually disable (but keep visible) the per-row Upload, Approve, Reject, Waive, Re-categorize buttons in `StantonReviewSurface` when locked — tooltip on hover explains the lock.

**Step 18 — HACH revision badge**

Modify `lib/hach/payload-filter.ts` to add `hach_packet_revision` and `submitted_to_hach_at` to the HACH-visible allowlist. The other handoff columns (`submitted_to_hach_by`, `packet_locked`) remain Stanton-private.

Modify `app/api/hach/applications/[id]/route.ts` to surface those two fields.

Modify `components/review/HachReviewSurface.tsx`: when `hach_packet_revision > 1`, render a small badge near the header: "Revision N · updated on [date]". Tooltip: "Stanton has submitted this packet N times. The current version was submitted on [date]."

**Step 19 — Phase 2 tests**

Create `__tests__/document-lifecycle-phase2.test.ts`:
1. User without permission gets 403 on Send-to-HACH; button is not rendered.
2. User with permission: pre-flight failures block submit unless override + reason.
3. Send-to-HACH: writes all four state columns atomically; writes `submitted_to_hach` event; posts shared workspace system message; flips `hach_review_status`.
4. After submit, all Stanton write endpoints return 423 Locked.
5. Tenant-portal upload returns lock-friendly error.
6. Reopen: `packet_locked=FALSE`, `hach_review_status=NULL`; preserves submitted-to-hach audit columns; writes event; posts workspace message.
7. Re-submission after reopen increments `hach_packet_revision`.
8. HACH UI sees revision badge; HACH payload-filter still rejects banned keys (other handoff columns stay private).
9. Two concurrent Send-to-HACH requests: second returns 409 (row lock).

**Step 20 — Phase 2 verification gates**

- `npm run build` — zero errors.
- `npm test` — all green.
- Manual end-to-end: upload a doc as staff → review and approve → run preflight → Send to HACH with override (one failing check) → lock banner appears → all write buttons disabled → click Reopen with reason → lock clears → re-submit → revision badge shows "Revision 2" on HACH side.
- Wall test: in browser as HACH session, network panel shows no `submitted_to_hach_by`, no `packet_locked`, no Stanton-private metadata.

If any gate fails, **stop and report**.

---

## Tech constraints

- Next.js App Router
- React 18+ functional components, hooks only
- TypeScript strict, no new `any`
- Supabase service-role queries inside route handlers; RLS not relied on for app-layer enforcement
- All multi-row state changes happen inside a single transaction
- Tailwind for Stanton UI; preserve existing HACH inline-style aesthetic
- Vitest for tests
- No new dependencies

---

## Hard NOs

- **Do NOT skip the events-helper transaction-required contract.** Every event write must be in the same transaction as the state change it describes.
- **Do NOT regress to a hard FK on `application_events`.** The polymorphic anchor pattern (per Generalization rule) is binding. If something breaks because there's no FK, fix it at the application layer with `resolveAnchor`, not by adding the FK back.
- **Do NOT genericize UI labels.** The Stanton review surface is PBV-specific: "Send to HACH", "Packet locked", "HACH review", "Reopen Packet", "Tenant Magic Link" all remain. No "Submit for partner review", no "Workflow record locked", no generic vocabulary. Refi UI will exist later with refi-specific labels; PBV and refi do not share a UI surface.
- **Do NOT modify `pbv_access_log`.** It stays narrow (security/access events).
- **Do NOT add `application_events` writes from outside `lib/events/application-events.ts`.** Single helper, single contract.
- **Do NOT auto-supersede on re-categorize.** Both originals stay.
- **Do NOT auto-reset handoff audit columns on Reopen.** Events preserve history.
- **Do NOT set `hach_review_status` anywhere except Send-to-HACH or Reopen.**
- **Do NOT delete or overwrite a `storage_path` on upload.** Every upload is a new row.
- **Do NOT add bulk upload, bulk Send-to-HACH, or any bulk-action that lives in this PRD.** Out of scope.
- **Do NOT introduce e-sign, real-time, or notification surfaces.** Other PRDs.
- **Do NOT introduce TODOs or placeholder code.** Production-grade everywhere.
- **Do NOT auto-fix unrelated bugs.** Note them in "Pre-existing issues observed."

---

## Build report requirements

Create `docs/build-reports/stanton-workspace-document-lifecycle_build-report_2026-05-13.md` with:

1. **PRD reference + execution mode confirmation**
2. **Phase 1 acceptance criteria** — every checkbox `[x]` or `[ ]` with note
3. **Phase 2 acceptance criteria** — same
4. **Files created** — list
5. **Files modified** — list + one-line summary each
6. **Files deleted** — list (should be empty)
7. **Migration verification** — `\d` output for changed tables, confirming columns and indexes
8. **Events table sanity** — count of events written by each test seed; spot-check a few rows
9. **Save-path registry** — every mutation introduced; endpoint, transaction shape, verification step
10. **Test output** — Vitest full output paste
11. **Manual walkthrough log** — Phase 1 walkthrough steps with screenshots; Phase 2 same
12. **HACH wall verification** — devtools-network observations confirming no Stanton-private columns leak
13. **Deviations from PRD** with reasoning (empty if none)
14. **Pre-existing issues observed** — out-of-scope, noted but not fixed
15. **Final pass/fail summary** — all gates from Step 10 + Step 20 in one table

---

## When you finish

Reply in chat with:
- Confirmation Phase 1 and Phase 2 both completed
- Pass/fail on each verification gate (Steps 10 + 20)
- Build report path + section count
- Anything that blocked you mid-build
- Specifically: did every save-path round-trip cleanly?
- Specifically: did the lock enforcement test cover all six write endpoints?
- Specifically: did HACH allowlist pass after adding the two new visible fields?

If any verification item fails, do not declare complete. Document the failure, stop, wait.
