# Windsurf Prompt — Packet Intake

> **DEPRECATED 2026-05-14.** Superseded by `pbv-02-packet-intake-prompt_2026-05-14.md`. Do not build from this prompt.

**PRD:** `docs/pbv-packet-intake_prd_2026-05-13.md` (read end-to-end before writing any code — note the architecture rule section at the top is binding)
**Build report (you create this):** `docs/build-reports/pbv-packet-intake_build-report_2026-05-13.md`
**Depends on:** `stanton-workspace-document-lifecycle` must be merged first. If the polymorphic `application_events` table (with `anchor_type`/`anchor_id`), per-row Upload modal, document versioning, and the `upload_source` enum on `form_submission_documents` do not exist, STOP and report.

---

## Context

You are building **bulk packet intake** for Stanton staff processing walk-in PBV application packets. A tenant walks into the office with a stack of paper documents — paystubs, bank statements, IDs, signed forms. Staff scans the whole stack, uploads it as one (or several) multi-page files, the system splits the pages, runs OCR, suggests doc-type classifications, and lets staff drag pages onto the application's document rows. On commit, properly versioned `form_submission_documents` rows are created with staff provenance and full audit trail.

The PRD is the source of truth. This prompt does not restate it; it directs the implementation.

**This build also unifies document seeding** from `form_document_templates` into a single primitive used by both tenant intake (existing) and packet intake (new). The placeholder application at `/admin/pbv/full-applications/{placeholder_id}` currently has zero document rows because it bypassed the seeding path; the new admin endpoint backfills it.

---

## Required reading before you start

1. **`docs/pbv-packet-intake_prd_2026-05-13.md`** — entire document. Every section. Every decision point.
2. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — for the versioning model, `source` enum, `application_events` table, and per-row Upload behavior. Your work must compose cleanly with what that PRD delivered.
3. **`supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`** — the canonical template seed. Understand `per_person`, `applies_to`, `member_filter`, and `conditional_on` semantics.
4. **`app/api/forms/[id]/submissions/route.ts`** — the current inline seeding loop. You extract this into a shared primitive.
5. **`lib/memberFilter.ts`** — `matchesMemberFilter()` and `getApplicableMembers()`. You consume these unchanged.
6. **`app/api/admin/scan-upload/route.ts`** — the existing PDF splitter using `pdfjs-dist` and `sharp`. You extract its PDF→page-image logic into a shared helper.
7. **`supabase/migrations/create_scan_tables.sql`** — read so you understand what you are **not** reusing. Confirm the PRD's recommendation (new parallel tables, Option A).
8. **`components/review/StantonReviewSurface.tsx`** — you add the "Intake Packet" toolbar button and a visual group for `doc_type='custom'` rows.
9. **`components/review/DocumentRow.tsx`** — confirm the `source='packet_intake'` rendering path exists (lifecycle PRD). Extend if not.
10. **`lib/auth.ts`** — session shape and current-user helpers.
11. **`lib/audit.ts`** — `logAudit` signature.
12. **An existing Vitest test file** (e.g., `lib/__tests__/notifications.test.ts`) — match the test pattern.

---

## Closed decisions (already settled — do not relitigate)

The following are closed in the PRD (see "Closed decisions" section). Do not ask to reconfirm; just implement:

1. **OCR provider:** Claude API vision. Confirm env var, model name, and rate-limit settings exist before Phase 3. If env vars are missing, stop and report — do not invent values.
2. **`scan_batches` reuse:** New parallel tables (`intake_batches`, `intake_pages`). Existing `scan_batches` / `scan_extractions` are untouched.
3. **Intake route placement:** PBV UI surface at `/admin/pbv/full-applications/[id]/intake`; data layer is form-agnostic.
4. **Generalization:** Data layer is form-agnostic (tables hung off `form_submissions`, `doc_type_signatures` keyed by `form_id`). UI layer uses PBV vocabulary.

## Decisions still open — confirm before coding the affected phase

1. **Seeding idempotency key.** PRD calls out that `(form_submission_id, doc_type, person_slot, original_doc_type)` is a candidate but needs confirmation against the lifecycle PRD's revision model. Read the lifecycle migration, propose the exact unique constraint, get sign-off before adding the constraint.

The remaining items (source enum confirmation, intake route placement) are settled by the PRD if the lifecycle PRD has shipped. Verify in code rather than asking.

---

## Build this pass

### Phase 1 — Unified seeding primitive

Create `lib/documents/seedFromTemplates.ts` exporting `seedDocumentsForSubmission(params)`.

Refactor `app/api/forms/[id]/submissions/route.ts` to call it. Behavior must be byte-identical for tenant intake — the existing tests must pass without modification.

Create `POST /api/admin/submissions/[form_submission_id]/seed-documents` (generic — form-agnostic; not PBV-scoped). It:
- Authenticates as a Stanton user.
- Loads the `form_submissions` row by id; derives `form_id` from it; uses that to pull templates.
- Calls `seedDocumentsForSubmission` idempotently (no duplicate rows on re-run).
- Returns `{ inserted: number, perTemplate: { [doc_type]: number } }`.

The PBV UI surface resolves `form_submission_id` from the application before calling this endpoint. Tenant assessment, rental application, or any other form consumer can call the same endpoint with its own `form_submission_id`.

After this phase, hit the endpoint manually against the placeholder application and confirm rows appear in `StantonReviewSurface`.

**Done when:**
- All existing tenant-intake tests pass with zero changes.
- The placeholder application page (`/admin/pbv/full-applications/{placeholder_id}`) shows the correct number of seeded document rows after one call to the endpoint.
- A second call to the endpoint inserts zero new rows (idempotent).
- New unit test `lib/documents/__tests__/seedFromTemplates.test.ts` covers: submission-level, each-adult, each-member-matching-rule, idempotency, conditional templates not materializing extra rows.

### Phase 2 — Intake batch infrastructure

Create migration `supabase/migrations/20260513170000_pbv_packet_intake.sql` with `intake_batches`, `intake_pages`, and `doc_type_signatures` tables exactly as specified in the PRD data model section.

- `IF NOT EXISTS` throughout.
- RLS enabled, service_role full access policy.
- Indexes per PRD.
- Rollback comment at top.
- `doc_type_signatures` seeded for every PBV doc_type listed in `form_document_templates` for `form_id='pbv-full-application'`. Signature patterns per the PRD's section 4 plus any other high-precision matchers you discover while reading the PDF forms.

Extract `app/api/admin/scan-upload/route.ts`'s PDF-splitting logic into `lib/scan/splitPdf.ts`. The existing scan-upload route imports the new helper. Verify the existing scan-upload tests still pass.

Create `POST /api/admin/pbv/full-applications/[id]/intake/upload`:
- Accepts multipart form-data with one or more files (PDF, JPG, PNG, HEIC).
- Creates a `intake_batches` row with `status='uploading'`.
- For each file, splits into per-page images using `lib/scan/splitPdf.ts` (PDF) or `sharp` (image conversion to JPG for HEIC and normalized format for JPG/PNG).
- Saves each page to Supabase Storage at `pbv-intake-staging/{batch_id}/{global_index}.jpg`.
- Inserts `intake_pages` rows with `image_path` set, OCR fields null at this stage.
- Updates `intake_batches.total_pages`, sets `status='classifying'`.
- Returns the batch ID.

**Done when:**
- A 30-page test PDF round-trips end-to-end: upload → 30 page rows in DB → 30 image files in storage.
- A mixed batch (1 PDF + 3 JPG + 1 HEIC) produces the right number of pages and all images are JPG.
- Existing scan-upload tests pass.

### Phase 3 — OCR + classifier

Create `lib/intake/ocr.ts` calling the agreed OCR provider. Returns `{ text: string, confidence: 'high' | 'medium' | 'low' | 'none' }` for a given page image.

Create `lib/intake/classifier.ts`:
- Loads `doc_type_signatures` once and caches.
- `classifyPage(text, householdMembers): { suggested_doc_type, suggested_person_slot, suggested_score, ocr_confidence }`.
- Scoring per PRD section 4. Confidence buckets per PRD.
- Person-slot detection: scan extracted text for each household member's last name + first initial. Exactly one match → suggest that slot. Zero or multiple → no suggestion.

Extend the upload endpoint to call OCR + classification synchronously for each page, populating `extracted_text`, `suggested_doc_type`, `suggested_person_slot`, `suggested_score`, `ocr_confidence` on `intake_pages`.

Add a fixture set: `__tests__/fixtures/intake-packets/` containing 10–15 sample pages covering the canonical doc types (you may need to ask Alex for real samples or synthesize obviously-labeled ones). Build a test that runs OCR + classifier against the fixtures and asserts ≥80% correct suggestions at high or medium confidence.

**Done when:**
- Fixture test passes the ≥80% threshold.
- Person-slot detection is correct for any fixture that names a single household member.
- OCR/classifier failures (provider error, etc.) are logged and the page still gets a row with `ocr_confidence='none'` so the batch is not blocked.

### Phase 4 — Classify UI

Create the route `/admin/pbv/full-applications/[id]/intake` at `app/admin/pbv/full-applications/[id]/intake/page.tsx`.

Implement the three phases (Upload → Classify → Commit) per PRD section 3.

Classify UI requirements:
- Two-column layout: pages on the left, target document rows + Custom + Discard on the right.
- Each page thumbnail shows: page number, source filename, OCR-suggested doc_type with confidence badge (high=green, medium=yellow, low=gray, none=neutral), suggested person_slot if any.
- Drag-and-drop assignment via native HTML5 drag API or `@dnd-kit/core` (only if not already in the bundle — do not introduce a new drag library if one is already there; check `package.json`).
- Multi-select (shift-click) for multi-page document grouping.
- "Custom" target with on-drop label prompt.
- "Discard" target for blank pages / separators.
- Commit button disabled while any pages unassigned (excluding discards).
- Assignment state persists to `intake_pages.staged_assignment` JSONB on every interaction — staff can leave and resume.

Add the **"Intake Packet"** button to `components/review/StantonReviewSurface.tsx` toolbar that links to the new route.

**Done when:**
- Manual test: a staff user classifies a 20-page batch end-to-end without losing work after refresh.
- All page assignments persist across reload.
- Custom documents prompt for a label and accept it.
- Discard target removes pages from the unassigned count without committing yet.

### Phase 5 — Commit + audit

Create `POST /api/admin/pbv/full-applications/[id]/intake/[batch_id]/commit`:

- Runs in a single DB transaction.
- For each grouped assignment: insert a `form_submission_documents` row (or new revision per lifecycle PRD's versioning model) with `uploaded_by_role='staff'`, `uploaded_by_display_name=<current user>`, `source='packet_intake'`, `staff_upload_note=<batch label if provided>`.
- For Custom: insert with `doc_type='custom'`, `required=false`, `requires_signature=false`, label from staff input, `display_order=MAX+10`, `original_doc_type=null`.
- Moves storage files from `pbv-intake-staging/{batch_id}/...` to `pbv-documents/{application_id}/{document_id}/{revision}.{ext}` **after** the DB transaction commits.
- Writes `application_events` rows: one `document_uploaded` per committed doc, one `packet_intake_committed` summary.
- Marks `intake_batches.status='committed'`, sets `committed_at` and `committed_document_count`.
- On any failure within the DB transaction: rolls back, batch status untouched, no storage moves attempted.
- On a storage-move failure post-DB-commit: logs the failure, marks the affected document with a retry flag (define a column or a separate `intake_storage_retries` table — your call, document it).

Confirmation modal in the UI before commit:
- Total pages assigned.
- Breakdown: N pages → M template documents, K pages → L custom documents, P pages → discarded.
- Person-slot summary.

After commit, redirect to `/admin/pbv/full-applications/[id]` (the review surface).

Update `StantonReviewSurface` to render `doc_type='custom'` rows in a separate visual group ("Additional Documents") below the standard categories, and confirm they do not count toward the `Docs Approved` tile.

**Done when:**
- Committing a packet produces exactly the expected `form_submission_documents` rows and revisions.
- A rollback test (force a storage failure mid-commit) leaves DB and storage in a consistent state.
- `application_events` shows the expected entries.
- Custom docs appear in their own group and do not affect the required-doc completeness counter or the Send-to-HACH gate.
- The `intake_batches` status transitions are correct.

### Phase 6 — Polish

- Empty states for every phase (no batches yet, no pages uploaded, classify view with no rows seeded).
- Error states: OCR provider failure, storage failure, unauthorized access, batch belongs to a different application.
- A "Packet History" expander on the intake route listing prior batches for this application with status, page count, committed doc count, timestamp.
- Storage cleanup job (a `scripts/cleanup-abandoned-intake-batches.ts` script — Alex will schedule it via Vercel cron after merge) that deletes staging files for batches in `abandoned` or `committed` status older than 7 days.

---

## Tech constraints

- Next.js App Router
- Supabase admin client with service_role (existing `lib/supabase.ts` pattern)
- iron-session via `lib/auth.ts`
- TypeScript strict — no `any` in new code
- Vitest for tests
- `pdfjs-dist`, `sharp`, `pdf-lib` — already in the bundle, reuse
- Do not introduce new libraries except where explicitly authorized:
  - OCR provider client if the agreed choice requires one
  - `@dnd-kit/core` if and only if no drag library is already present in `package.json`
- Use `gen_random_uuid()` for IDs
- Migrations are idempotent (`IF NOT EXISTS`)

---

## Hard NOs

- **Do NOT modify the existing `scan_batches` / `scan_extractions` tables.** They belong to a different domain. The PRD's Option A (new parallel tables) is the path.
- **Do NOT collapse seeding into the API route after extracting it.** The whole point of `seedFromTemplates.ts` is one source of truth. Tenant intake POST and the new admin endpoint both call into the same function.
- **Do NOT make custom documents count toward the required-doc completeness counter.** They are intentionally outside that tally. The `Docs Approved: N/N req` math operates on `required=true` rows only — verify your changes preserve that.
- **Do NOT block Send-to-HACH on custom documents.** Same reasoning.
- **Do NOT auto-classify pages to person slots without OCR evidence.** Slot suggestions are made only when exactly one household member's name appears in the page text. Otherwise the suggestion is null and staff classifies manually.
- **Do NOT auto-commit OCR suggestions.** Suggestions are pre-fills, not assignments. Staff confirms by leaving the suggestion in place; explicit user action commits.
- **Do NOT skip the staging→final storage move pattern.** Pages live in staging until commit. Committed pages move to the canonical document storage path. This is non-negotiable for rollback semantics.
- **Do NOT add placeholder code or TODOs.**
- **Do NOT auto-fix unrelated bugs you spot** — note them under "Pre-existing issues observed" in the build report.
- **Do NOT skip the verification phase.**

---

## Verification phase (mandatory)

End-to-end checks before declaring done. **Skipping any of these means the task is not complete.**

*Save-path test standards (harness setup, no-mocks rule, helper-throws rule, drift check): see `docs/verification-methodology_2026-05-13.md`.*

1. **Migrations apply clean.** Apply against local dev DB. No errors. All three new tables exist with correct constraints. `doc_type_signatures` is seeded.

2. **`npm run build` succeeds.** Zero errors.

3. **TypeScript compiles strict.** No new `any`, no implicit returns.

4. **`npm test` passes.** Every new test green. Existing tests untouched and green.

5. **Seeding end-to-end check.**
   - Hit `POST /api/admin/pbv/full-applications/{placeholder_id}/seed-documents` against the placeholder.
   - Confirm in DB: row count matches expected (count by template expansion against the household).
   - Reload `/admin/pbv/full-applications/{placeholder_id}` — document rows render in `StantonReviewSurface`.
   - Hit the endpoint a second time — response shows `inserted: 0`.

6. **Real packet walkthrough.** Prepare or obtain a test packet with at least:
   - 4 pages of paystubs
   - 2 pages of a bank statement
   - 1 HUD-9886-A signed
   - 1 HACH Release signed
   - 1 page that is a court order (not on template — must land as Custom)
   - 1 blank page (must land as Discard)
   
   Run the full intake flow. Document:
   - Upload phase: file count, total pages, batch ID
   - Classify phase: OCR confidence per page, suggested doc_type per page, suggested slot per page, what you accepted vs. corrected
   - Commit phase: confirmation modal contents, final `form_submission_documents` rows inserted (paste DB result), `application_events` rows written (paste)
   - Custom court order appears in "Additional Documents" group
   - `Docs Approved: N/N req` tile does not count the court order
   - Discarded blank page does not appear anywhere committed

7. **Rollback test.** Force a storage failure during commit (e.g., by setting an invalid bucket name in a feature-flagged test path, or by mocking storage). Confirm:
   - No `form_submission_documents` rows created.
   - No `application_events` written.
   - `intake_batches.status` did not transition to `committed`.
   - Pages remain in staging storage.

8. **Idempotency test for seeding.** Run the admin seed endpoint twice in succession against a freshly created application. Second run must insert zero rows.

9. **Resume test.** Mid-classify, kill the browser. Reopen the intake route. All previous assignments are preserved exactly.

10. **Cross-application isolation.** Confirm that batch IDs from one application cannot be committed against a different application. Construct the malicious request manually. Expect 403 or 404.

11. **OCR fixture test ≥80% pass rate.** From Phase 3. Document the actual pass rate.

If any of 1–11 fails, **do not declare done**. Leave the task open, report what failed, await instruction.

---

## Build report requirements

Create `docs/build-reports/pbv-packet-intake_build-report_2026-05-13.md`:

### 1. Pre-build decisions
- OCR provider (chosen + why)
- scan_batches reuse (Option A confirmed)
- Seeding idempotency unique constraint (exact column list)
- Any deviation from PRD with reasoning

### 2. Migrations
- File path, applied successfully Y/N, `\d+` output for each new table.

### 3. PRD requirements checklist
Every Goal and acceptance criterion in the PRD with `[x]` or `[ ]` and a one-line note.

### 4. Files created
List with one-line description.

### 5. Files modified
Each modified file + summary of changes.

### 6. Test results
- Full Vitest output (paste).
- Per-phase acceptance criteria status.
- OCR fixture test pass rate (exact percentage).

### 7. Real packet walkthrough log
Step-by-step results for verification phase item 6. Include DB row dumps, `application_events` dump, and screenshots if practical.

### 8. Rollback test result
Verification phase item 7. Document forced-failure mechanism and observed DB/storage state.

### 9. End-to-end save verification
For each write endpoint: payload, SQL verification query, result.

### 10. Cross-side / cross-application access matrix
Items 5 (seeding idempotency), 10 (cross-app isolation), and any other security checks.

### 11. Deviations from the PRD
If any. Reasoning. Empty if none.

### 12. Pre-existing issues observed
Anything broken or risky out of scope. Do not fix.

### 13. Verification phase results
Items 1–11 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report file length (lines)
- Section count
- Confirmation every section is populated
- Each Verification phase item (1–11) pass/fail status
- OCR fixture test pass rate
- Real packet walkthrough — did all 11 verification items succeed end-to-end
- Anything that blocked you

If any test fails, any verification item fails, or any check returns the wrong status, do not declare complete. Leave the task in progress and stop.
