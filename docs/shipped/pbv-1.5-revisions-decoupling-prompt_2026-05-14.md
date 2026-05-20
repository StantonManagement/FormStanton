# Windsurf Prompt — PBV Document Revisions Decoupling

**PRD:** `docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md` (read end-to-end; the architecture rule section is binding)
**Build report (you create this):** `docs/build-reports/pbv-1.5-revisions-decoupling-build-report_2026-05-14.md`
**Depends on:** `pbv-01-documents-decoupling-prd_2026-05-14.md` must be merged. Specifically: `application_documents` exists, the PRD-01 migration has run, and either `_migration_pbv_documents_map` or `form_submission_documents.migrated_to_application_documents_id` is intact. If neither exists, **STOP and report** — the join key for migrating revisions is required.
**Blocks (soft):** PRD-02 Packet Intake is not strictly blocked (packet intake creates new docs, not revisions of existing ones), but the review surface UI is incomplete until this PRD ships. Ship this before PRD-02 unless explicitly told otherwise.

---

## Context

PRD-01 relocated PBV documents from `form_submission_documents` to `application_documents`. Revisions for those documents still live in `form_submission_document_revisions`, keyed against the old substrate. This is a scope hole in PRD-01: the prior-versions expander still queries the submission-keyed surface, and PBV write paths that create revisions are wired to the old table.

This build creates `application_document_revisions` (FK to `application_documents`, polymorphism inherited via parent), migrates existing PBV revisions, retargets read and write paths, and updates `PriorVersionsExpander`. A scope addition (section 6 of the PRD): consider removing the submission-keyed fallback from `StantonReviewSurface` and friends, since the PRD-01 audit flagged it as a footgun.

The PRD is the source of truth. This prompt directs implementation.

---

## Required reading before you start

1. **`docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md`** — entire document.
2. **`docs/pbv-01-documents-decoupling-prd_2026-05-14.md`** + its build report — for `application_documents` shape, the migration map artifact, and the URL pattern.
3. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory.
4. **`supabase/migrations/20260514120000_application_documents.sql`** — PRD-01's parent table migration; understand the column model.
5. **`supabase/migrations/20260514130000_migrate_pbv_documents.sql`** — PRD-01's migration; understand the `_migration_pbv_documents_map` artifact and the `migrated_to_application_documents_id` marker.
6. **The live `form_submission_document_revisions` table schema.** Diff against the PRD's expected columns and report.
7. **`app/api/admin/submissions/[submissionId]/documents/[documentId]/revisions/route.ts`** — existing endpoint. The new application-keyed endpoint mirrors its response contract.
8. **`components/review/PriorVersionsExpander.tsx`** — client. Migration pattern follows the `UploadDialog` / `RecategorizeDialog` refactor from PRD-01 (URL prop, not submission_id prop).
9. **`components/review/StantonReviewSurface.tsx`** — the PBV-facing URL constructor lives here. The PRD-01 audit flagged the `anchorType && anchorId ? new : old_fallback` ternary as a footgun. Section 6 of this PRD addresses it.
10. **PBV write routes from PRD-01 Phase 3** (under `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/...`) — wherever they currently insert into `form_submission_document_revisions`, you'll retarget. Identify whether there's a centralized helper.

---

## Closed decisions (do not relitigate)

Per PRD section "Closed decisions":

1. Revisions table polymorphism is inherited via FK to `application_documents`. No direct `anchor_type`/`anchor_id` on the revisions table.
2. Source rows preserved with `migrated_to_application_document_revisions_id` marker.
3. New endpoint at `/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/revisions`.
4. Structural parity with `form_submission_document_revisions`.
5. Existing submission-keyed revisions endpoint stays for non-PBV consumers.

---

## Decisions still open — confirm before coding the affected phase

Per PRD section "Open questions for Windsurf":

1. **Column inventory diff** of `form_submission_document_revisions` against the PRD's expected columns. Post the diff in chat for sign-off before writing the migration.
2. **`_migration_pbv_documents_map` availability.** Confirm it still exists. If not, plan to use `form_submission_documents.migrated_to_application_documents_id` as the join key.
3. **Triggers / RLS policies / views / downstream consumers** of `form_submission_document_revisions`. Enumerate everything and post the inventory.
4. **Centralized revision-creation helper.** Locate it (or confirm there isn't one). If centralized: update the helper. If inlined per-route: update each route.
5. **Section 6 fallback scope.** Before Phase 4, post a recommendation in chat: Option A (required props, no fallback — preferred per the PRD) vs Option B (loud-error fallback) vs carving out to a separate micro-PRD. Wait for Alex's sign-off before applying.

---

## Build this pass

Five phases per PRD section "Implementation Phases." Do not skip, merge, or reorder.

### Phase 1 — New table + read endpoint

- Create migration `supabase/migrations/<ts>_application_document_revisions.sql` with the new table, indexes, constraints, RLS. Structural parity with `form_submission_document_revisions` modulo the anchor swap.
- Add `IF NOT EXISTS` throughout, RLS enabled, service_role policy.
- Create endpoint `GET /api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/revisions` that resolves the document under the given anchor and returns revisions from the new table. Response shape identical to the existing submission-keyed endpoint.

**Done when:**
- Table exists; structural diff against `form_submission_document_revisions` is zero (modulo anchor).
- New endpoint returns empty array for valid anchors with no migrated data yet (before Phase 2 runs).
- Existing tenant-intake of non-PBV forms continues to record revisions in `form_submission_document_revisions`; existing tests green.

### Phase 2 — Existing data migration

- Migration SQL (or `scripts/migrate-pbv-revisions.ts` — your call, document the choice) that:
  - Adds `form_submission_document_revisions.migrated_to_application_document_revisions_id UUID NULL`.
  - Creates `_migration_pbv_revisions_map` (old_id, new_id, migrated_at).
  - For each source row, looks up the parent in `form_submission_documents`. If that parent has a `migrated_to_application_documents_id` (or is in `_migration_pbv_documents_map`), insert an equivalent row in `application_document_revisions` with `application_document_id` set to the mapped new doc id.
  - Copy every field value verbatim.
  - Record old → new in the map and on the source row.
- Inverse script clearing the new table, the marker column, and the map.
- Idempotent.

**Done when:**
- For every PBV doc in `application_documents` with `revision > 1` (or with prior revisions in source), all prior revisions resolve to rows in `application_document_revisions`.
- Row counts and field values match source for every migrated row (paste diff query result).
- Re-running migration is a no-op.
- Inverse script restores prior state on a copy of test data.

### Phase 3 — Write-path migration

- For each PBV write route from PRD-01 Phase 3 (`approve`, `reject`, `waive`, `categorize`, `upload`, `tier2`, plus any new `bulk-assign` route added per the PRD-01 audit), identify where it currently writes to `form_submission_document_revisions`.
- Retarget those writes to `application_document_revisions` with the parent's `application_document_id`.
- If revision creation is centralized in a helper, update the helper.

**Done when:**
- Every existing automated test touching a PBV revision write passes against the new table.
- Grep across the codebase confirms no PBV write path writes to `form_submission_document_revisions`.
- Dynamic check: trigger each PBV write path that creates a revision; the row lands in `application_document_revisions`, not the old table.

### Phase 4 — Read-path migration + UI

- `PriorVersionsExpander.tsx`: replace `submissionId` prop with `revisionsUrl` prop (or accept both for backward compat — but PBV callers must use `revisionsUrl`). Update internal fetch to call the prop value.
- `StantonReviewSurface.tsx`: construct the application-keyed `revisionsUrl` and pass it to `PriorVersionsExpander`. Apply the same `anchorType && anchorId ? new : fallback` pattern PRD-01 used **only if the fallback survives section 6**.
- **Section 6 application:** apply whichever option Alex signed off on for the fallback fix. If Option A (required props, no fallback): update `StantonReviewSurface`, `UploadDialog`, `RecategorizeDialog`, `PriorVersionsExpander` to require `anchorType`/`anchorId` (or the explicit URL props derived from them). Remove submission-keyed fallback code paths from these components. Update all callers.
- Identify and update any other PBV consumer of revision data (Windsurf does the grep).

**Done when:**
- Manual walkthrough: prior versions expander on a PBV application with multiple revisions shows identical content before and after migration. Screenshots paired.
- Grep across PBV code paths returns zero hits for `form_submission_document_revisions` and zero hits for submission-keyed revisions URL pattern from PBV-only consumers.
- If section 6 Option A applied: grep for the fallback pattern (`/api/admin/submissions/${application.form_submission_id}/...`) returns zero hits in PBV-facing components.

### Phase 5 — Verification + cutover plan

- Verification phase per `docs/verification-methodology_2026-05-13.md`.
- Documented cutover plan: deploy steps, duration, rollback trigger, monitoring queries.
- Pre/post cutover query: revision history identical for every PBV application.

**Done when:**
- All verification phase items pass.
- Cutover plan posted in build report.

---

## Tech constraints

- Next.js App Router
- Supabase admin client with service_role
- iron-session via `lib/auth.ts`
- TypeScript strict — no `any` in new code
- Vitest for tests
- `gen_random_uuid()` for IDs
- Migrations idempotent (`IF NOT EXISTS`)

---

## Hard NOs

- **Do NOT delete any `form_submission_document_revisions` rows.** Mark migrated. Cleanup is the same future PRD that handles `form_submission_documents` deletion.
- **Do NOT modify non-PBV code paths.** Other form types continue using `form_submission_document_revisions` and the submission-keyed endpoint.
- **Do NOT add `anchor_type` / `anchor_id` columns to `application_document_revisions`.** Polymorphism inherits via parent FK.
- **Do NOT add an FK from `application_documents` to the revisions table.** The FK direction is revisions → documents, not the reverse.
- **Do NOT change revision-creation semantics.** When revisions are created, sequencing rules, retention behavior — all unchanged. This PRD relocates rows, not behavior.
- **Do NOT skip section 6.** Apply whichever option Alex signed off on. If you cannot get sign-off in a reasonable window, post a recommendation and proceed with Option A as the default — it's the cleaner fix.
- **Do NOT modify the existing submission-keyed revisions endpoint.** It remains for non-PBV consumers.
- **Do NOT add placeholder code or TODOs.**
- **Do NOT auto-fix unrelated bugs.** Note them in "Pre-existing issues observed."
- **Do NOT skip the verification phase.**

---

## Verification phase (mandatory)

End-to-end checks. Skipping any of these means the task is not complete.

*Save-path test standards (harness, no-mocks rule, helper-throws rule, drift check): see `docs/verification-methodology_2026-05-13.md`.*

1. **Migrations apply clean.** `application_document_revisions` exists with correct shape, indexes, constraints, RLS.
2. **Structural parity diff.** Diff `application_document_revisions` against `form_submission_document_revisions` (modulo anchor) returns zero unaccounted differences.
3. **`npm run build` succeeds.** Zero errors.
4. **TypeScript strict.** No new `any`, no implicit returns. **Confirm by running a clean `tsc --noEmit`, not by waving away IDE cache.**
5. **`npm test` passes.** Every new test green; existing tests untouched and green.
6. **Data migration end-to-end.**
   - Run migration script against prod-shaped test data.
   - For every PBV doc, diff `application_document_revisions` rows against `form_submission_document_revisions` rows that share the migration map. Zero unaccounted field-value differences.
   - Re-running migration is a no-op (idempotency).
   - Inverse script restores prior state.
7. **PriorVersionsExpander walkthrough.** Open a PBV application with at least 3 revisions on one document. Confirm the expander shows identical content pre/post. Screenshots in build report.
8. **Write-path dynamic check.** Trigger each PBV write path that creates a revision (re-upload after rejection, recategorize, etc.). Confirm row in `application_document_revisions`; zero new rows in `form_submission_document_revisions` from PBV paths.
9. **Cross-application isolation.** Confirm revisions of one application's docs cannot be read or written under a different application's anchor. Manual malicious request → 403 or 404.
10. **Anchor leakage grep.** `grep -r form_submission_document_revisions` across new code paths from this build. Zero hits except migration code. Particularly: zero hits in `app/api/admin/applications/...`, `components/review/PriorVersionsExpander.tsx`, and any PBV-only code paths.
11. **Submission-keyed fallback removal (if section 6 Option A applied).** Grep `/api/admin/submissions/\\${application.form_submission_id}` across `components/review/` and `app/admin/pbv/`. Zero hits.
12. **Non-PBV regression check.** Tenant intake of a non-PBV form (e.g., move-out notice) still records revisions in `form_submission_document_revisions`. Existing submission-keyed revisions endpoint still returns correct data for non-PBV consumers. Existing tests green.

If any of 1–12 fails, **do not declare done.** Stop, report, await instruction.

---

## Build report requirements

Create `docs/build-reports/pbv-1.5-revisions-decoupling-build-report_2026-05-14.md`:

1. **Pre-build decisions.** Column inventory diff result. `_migration_pbv_documents_map` availability check. Triggers/RLS/views inventory. Centralized helper status. Section 6 option chosen + Alex's sign-off reference.
2. **Migrations.** File path, applied Y/N, `\d` output for new table, structural parity diff output.
3. **PRD goals checklist.** Every goal with `[x]` or `[ ]` and a one-line note.
4. **Files created.** One-line description each.
5. **Files modified.** Summary per file.
6. **Test results.** Full Vitest output. Per-phase acceptance criteria.
7. **Data migration walkthrough.** Row counts, diff query results, idempotency check, rollback test.
8. **PriorVersionsExpander walkthrough.** Before/after screenshots of revision history on a multi-revision PBV doc.
9. **Write-path dynamic check.** For each PBV write path that creates a revision: trigger payload, SQL verification query, result.
10. **Section 6 application.** Which option, scope of component changes, callers updated, fallback grep result.
11. **Anchor leakage grep audit.** Items 10, 11.
12. **Non-PBV regression check.** Item 12 results.
13. **Cutover plan.** Steps, durations, rollback trigger, owner.
14. **Deviations from PRD.** Reasoning. Empty if none.
15. **Pre-existing issues observed.** Anything broken/risky out of scope. Do not fix.
16. **Verification phase results.** Items 1–12 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report length (lines), section count, confirmation every section is populated.
- Verification items 1–12 pass/fail.
- Migration row count.
- Section 6 option applied.
- Anything that blocked you.

If any test fails, any verification item fails, or any check returns the wrong status, do not declare complete. Stop and report.
