# Windsurf Prompt — PBV Documents Decoupling

**PRD:** `docs/pbv-01-documents-decoupling-prd_2026-05-14.md` (read end-to-end before writing any code — the architecture rule section is binding)
**Build report (you create this):** `docs/build-reports/pbv-01-documents-decoupling-build-report_2026-05-14.md`
**Depends on:** `stanton-workspace-document-lifecycle` must be merged. `application_events` polymorphic anchor (`anchor_type`/`anchor_id`) must exist (`20260513200000_application_events_generalize.sql`).
**Blocks:** PBV Packet Intake (`docs/pbv-02-packet-intake-prd_2026-05-14.md`). Do not start that build until this one is merged.

---

## Context

PBV documents currently live in `form_submission_documents`, joined to PBV applications via `pbv_full_applications.form_submission_id`. This build relocates them to a new polymorphic `application_documents` table with `(anchor_type='pbv_full_application', anchor_id=<pbv_full_applications.id>)`. The pattern mirrors `application_events`. It is structured to support refi and any future multi-step workflow without further substrate migration.

The PRD is the source of truth. This prompt directs implementation.

---

## Required reading before you start

1. **`docs/pbv-01-documents-decoupling-prd_2026-05-14.md`** — entire document.
2. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — column model and lifecycle for the existing `form_submission_documents` table. The new table mirrors this exactly except for the anchor swap.
3. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory for the verification phase.
4. **`supabase/migrations/20260513200000_application_events_generalize.sql`** (or equivalent — confirm the filename in `supabase/migrations/`) — the polymorphic anchor pattern to mirror.
5. **`supabase/migrations/20260423180000_foundation_review_per_document.sql`** — the foundation `form_submission_documents` table definition. Diff against this when writing the new migration.
6. **`app/api/forms/[id]/submissions/route.ts`** — existing tenant intake POST that seeds from `form_document_templates`. Refactor target for the seeding primitive split.
7. **`lib/memberFilter.ts`** — `matchesMemberFilter()` and `getApplicableMembers()`. Reused unchanged by the new seeding primitive.
8. **`components/review/StantonReviewSurface.tsx`** and **`components/review/DocumentRow.tsx`** — read-path consumers. Identify every query against `form_submission_documents` in these and update.
9. **All API routes under `app/api/admin/pbv/full-applications/[id]/...`** — write-path and read-path consumers.
10. **`lib/auth.ts`**, **`lib/audit.ts`**, **`lib/supabase.ts`** — session, audit, and admin-client patterns.
11. **An existing Vitest test file** — match the test pattern.

---

## Closed decisions (do not relitigate)

Per PRD section "Closed decisions":

1. `application_documents` is polymorphic `(anchor_type, anchor_id)`. Not PBV-specific.
2. Templates stay in `form_document_templates` keyed by `form_id`.
3. Existing PBV docs are migrated to the new table; old rows are preserved with `migrated_to_application_documents_id`.
4. `application_events.document_id` retargets to `application_documents`. FK dropped; reference becomes soft.
5. Storage paths stay where they are. New rows reference existing paths.
6. Structural parity with `form_submission_documents`. Every non-anchor column on the source is mirrored on `application_documents`.

---

## Decisions still open — confirm before coding the affected phase

Per PRD section "Open questions for Windsurf":

1. **Column inventory diff.** Run a structural diff of `form_submission_documents` against the PRD's column list before writing the migration. Report any column not mirrored, with justification. Stop and post the diff for sign-off before proceeding.
2. **`upload_source` enum membership.** Confirm whether `'packet_intake'` is already in the source enum. Add it on `application_documents` regardless.
3. **Migration transactional boundary.** Report the prod row count from `form_submission_documents` joined through `pbv_full_applications`. If ≤10K, run in one transaction. If larger, chunk by application. Post the decision.
4. **Triggers / RLS policies / views on `form_submission_documents`.** Enumerate everything. Replicate the equivalents on `application_documents`. Post the inventory.

---

## Build this pass

Five phases per PRD section "Implementation Phases." Do not skip, merge, or reorder.

### Phase 1 — New table + seeding primitive

- Create migration `supabase/migrations/<ts>_application_documents.sql` with the new table, indexes, constraints, RLS. Structural parity with `form_submission_documents` (modulo anchor).
- Update `lib/documents/seedFromTemplates.ts` to export `seedDocumentsForApplication({ formId, anchorType, anchorId, householdMembers, transaction })`. Keep `seedDocumentsForSubmission` as a wrapper or remove if no longer used after Phase 3/4.
- Create endpoint `POST /api/admin/applications/[anchor_type]/[anchor_id]/seed-documents` calling the new primitive.

**Done when:**
- Table exists; structural diff against `form_submission_documents` is zero (modulo anchor).
- Seeding endpoint creates rows in `application_documents` for the placeholder PBV application.
- Re-running the endpoint inserts zero rows (idempotency).
- Tenant intake of non-PBV forms (move-out notice, pet approval, etc.) continues to behave identically; existing tests green.
- New unit tests in `lib/documents/__tests__/seedFromTemplates.test.ts` cover: submission-level, each-adult, each-member-matching-rule, idempotency, conditional templates.

### Phase 2 — Existing data migration

- Migration SQL (or one-off `scripts/migrate-pbv-documents.ts` — your call, document the choice) that copies all PBV documents from `form_submission_documents` to `application_documents`.
- Adds `form_submission_documents.migrated_to_application_documents_id UUID NULL` column.
- Creates transient `_migration_pbv_documents_map` table.
- Retargets `application_events.document_id` for PBV-anchored events using the map.
- Inverse script for rollback.
- Idempotent: re-running makes zero changes.

**Done when:**
- For every PBV application in a prod-shaped test dataset, `application_documents` row count and every field value matches the source `form_submission_documents` rows exactly.
- Every `application_events.document_id` for PBV-anchored events resolves to a row in `application_documents`.
- Re-running the migration is a no-op.
- Inverse script restores prior state on a copy of the test dataset.

### Phase 3 — Write-path migration

- Every PBV write path updated to write to `application_documents`. Architectural surfaces per PRD section "Core Features / 6. Write-path updates."

**Done when:**
- Every existing automated test touching a PBV document write passes against the new table.
- A grep across the codebase confirms no PBV write path writes to `form_submission_documents`.
- Dynamic check: triggering each PBV write path against a test application creates rows in `application_documents` and not in `form_submission_documents`.

### Phase 4 — Read-path migration

- Every PBV read path updated to read from `application_documents`. Architectural surfaces per PRD section "Core Features / 5. Read-path updates."

**Done when:**
- Every PBV-touching test passes against the new read path.
- Manual walkthrough of `/admin/pbv/full-applications/{placeholder_id}` and at least one fully-populated test application: review surface UI, document counts, status tiles, Send-to-HACH gating, packet lock indicator, completeness counter all behave identically to pre-migration. Screenshots required.
- A grep across the codebase confirms no PBV read path queries `form_submission_documents` (excluding migration code).

### Phase 5 — Verification + production cutover plan

- Verification phase per `docs/verification-methodology_2026-05-13.md` — save-path tests run against real DB, no mocks.
- Documented cutover plan: order of deploy steps, expected duration, rollback trigger, monitoring queries to run before and after, owner of the prod migration script execution.
- Pre/post cutover validation query: returns identical row counts and document-state distribution for every PBV application.

**Done when:**
- All verification phase items pass.
- Cutover plan posted in the build report and reviewed.

---

## Tech constraints

- Next.js App Router
- Supabase admin client with service_role (existing `lib/supabase.ts` pattern)
- iron-session via `lib/auth.ts`
- TypeScript strict — no `any` in new code
- Vitest for tests
- `gen_random_uuid()` for IDs
- Migrations idempotent (`IF NOT EXISTS`)

---

## Hard NOs

- **Do NOT delete any `form_submission_documents` rows.** Mark them migrated. Cleanup is a separate PRD.
- **Do NOT modify non-PBV code paths.** Other form types continue using `form_submission_documents`.
- **Do NOT change `form_document_templates` shape.**
- **Do NOT drop `pbv_full_applications.form_submission_id`.** Out of scope.
- **Do NOT add an FK from `application_documents.anchor_id` to any specific table.** Polymorphic; application-enforced.
- **Do NOT add an FK from `application_events.document_id` to `application_documents`.** Soft reference, matching the existing polymorphic pattern.
- **Do NOT add placeholder code or TODOs.**
- **Do NOT auto-fix unrelated bugs.** Note them under "Pre-existing issues observed" in the build report.
- **Do NOT skip the verification phase.**
- **Do NOT collapse phases.** Each phase is its own merge gate.

---

## Verification phase (mandatory)

End-to-end checks. Skipping any of these means the task is not complete.

*Save-path test standards (harness setup, no-mocks rule, helper-throws rule, drift check): see `docs/verification-methodology_2026-05-13.md`.*

1. **Migrations apply clean.** No errors. `application_documents` exists with correct shape, indexes, constraints, RLS.
2. **Structural parity diff.** Diff `application_documents` against `form_submission_documents` (modulo anchor) returns zero unaccounted differences.
3. **`npm run build` succeeds.** Zero errors.
4. **TypeScript strict.** No new `any`, no implicit returns.
5. **`npm test` passes.** Every new test green. Existing tests untouched and green.
6. **Seeding end-to-end.**
   - Hit `POST /api/admin/applications/pbv_full_application/{placeholder_id}/seed-documents`.
   - Confirm rows in `application_documents` match expected template-expansion count for the household.
   - Reload `/admin/pbv/full-applications/{placeholder_id}` — document rows render in `StantonReviewSurface`.
   - Hit the endpoint again — `inserted: 0`.
7. **Data migration end-to-end.**
   - Run migration script against prod-shaped test data.
   - For every PBV application, diff `application_documents` rows against the corresponding `form_submission_documents` rows. Zero unaccounted differences in field values.
   - Diff `application_events.document_id` resolution: every PBV-anchored event's `document_id` resolves to an `application_documents` row.
8. **Idempotency test for migration.** Run twice. Second run makes zero changes.
9. **Rollback test.** Run inverse script. State restored: `application_documents` empty, `application_events.document_id` references back at `form_submission_documents.id` for PBV-anchored events.
10. **Read-path manual walkthrough.** Compare review surface for placeholder + fully-populated test app before and after. Screenshots paired. Document counts, status tiles, completeness counter, Send-to-HACH gating: identical.
11. **Write-path dynamic check.** Trigger each PBV write path against a test application post-migration. Confirm rows land in `application_documents`; zero new rows in `form_submission_documents` from PBV paths.
12. **No leakage check.** `grep -r form_submission_documents` across PBV code paths after Phase 4. Zero hits outside migration code.

If any of 1–12 fails, **do not declare done.** Stop, report, await instruction.

---

## Build report requirements

Create `docs/build-reports/pbv-01-documents-decoupling-build-report_2026-05-14.md`:

1. **Pre-build decisions.** Column inventory diff. `upload_source` enum status. Migration transactional boundary decision and prod row count. Triggers/RLS/views inventory and replication.
2. **Migrations.** File path, applied successfully Y/N, `\d` output for new table, output of structural parity diff.
3. **PRD goals checklist.** Every Goal with `[x]` or `[ ]` and a one-line note.
4. **Files created.** One-line description each.
5. **Files modified.** Summary of changes per file.
6. **Test results.** Full Vitest output. Per-phase acceptance criteria status.
7. **Migration walkthrough log.** Step-by-step results for verification phase items 7–9. Include row count diffs, sample row diffs, screenshot of `application_events.document_id` resolution check.
8. **Read/write path grep audit.** Phase 3/4 grep results for `form_submission_documents` in PBV code.
9. **Manual UI walkthrough.** Before/after screenshots of `/admin/pbv/full-applications/{placeholder_id}` and the fully-populated test app.
10. **Cutover plan.** Steps, durations, rollback trigger, owner.
11. **Deviations from PRD.** Reasoning. Empty if none.
12. **Pre-existing issues observed.** Anything broken/risky out of scope. Do not fix.
13. **Verification phase results.** Items 1–12 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report file length (lines), section count, confirmation every section is populated.
- Verification items 1–12 pass/fail status.
- Migration row count (PBV rows copied).
- Rollback test outcome.
- Anything that blocked you.

If any test fails, any verification item fails, or any check returns the wrong status, do not declare complete. Leave the task in progress and stop.
