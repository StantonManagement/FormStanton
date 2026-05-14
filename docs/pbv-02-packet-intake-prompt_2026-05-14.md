# Windsurf Prompt — PBV Packet Intake

**PRD:** `docs/pbv-02-packet-intake-prd_2026-05-14.md` (read end-to-end; the architecture rule section is binding)
**Build report (you create this):** `docs/build-reports/pbv-02-packet-intake-build-report_2026-05-14.md`
**Depends on:** `pbv-01-documents-decoupling-prd_2026-05-14.md` MUST be merged. The `application_documents` table, `application_events` polymorphic anchor, retargeted `application_events.document_id`, and PBV write/read paths on `application_documents` must all be in place. If `application_documents` does not exist, **STOP and report** — do not attempt to build packet intake against `form_submission_documents`.

---

## Context

Bulk packet intake for Stanton staff processing walk-in PBV application packets. Tenant walks in with a stack of paper, staff scans the whole stack, uploads it as one or more multi-page files, the system splits the pages, runs OCR via Claude API vision, suggests doc-type classifications, and lets staff drag pages onto the application's document rows. On commit, properly versioned `application_documents` rows are created with staff provenance and full audit trail in `application_events`.

The PRD is the source of truth. This prompt directs implementation.

**Architecture rule (binding):** PBV anchors at `pbv_full_applications.id` via polymorphic `(anchor_type='pbv_full_application', anchor_id)`. Substrate tables (`intake_batches`, `intake_pages`, `doc_type_signatures`, `intake-staging/` bucket) are form-agnostic. API routes generic at `/api/admin/intake/[anchor_type]/[anchor_id]/...`. UI routes workflow-specific at `/admin/pbv/full-applications/[id]/intake`. Document writes go to `application_documents`. **No writes to `form_submission_documents` from any code path in this build.**

---

## Required reading before you start

1. **`docs/pbv-02-packet-intake-prd_2026-05-14.md`** — entire document.
2. **`docs/pbv-01-documents-decoupling-prd_2026-05-14.md`** + its build report — for the `application_documents` table shape, revision contract, anchor pattern, and the seeding primitive.
3. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — versioning model, `upload_source` enum, lifecycle behaviors on documents.
4. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory.
5. **`supabase/migrations/<ts>_application_documents.sql`** (delivered by PRD-01) — the document-table shape you write to.
6. **`supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`** — canonical template seed. Understand `per_person`, `applies_to`, `member_filter`, `conditional_on`.
7. **`app/api/admin/scan-upload/route.ts`** — existing PDF splitter using `pdfjs-dist` and `sharp`. Extract its PDF→page-image logic into `lib/scan/splitPdf.ts`.
8. **`supabase/migrations/create_scan_tables.sql`** — read so you understand what you are **not** reusing.
9. **`components/review/StantonReviewSurface.tsx`** — toolbar gets "Intake Packet" button; render a new "Additional Documents" group for `doc_type='custom'`.
10. **`components/review/DocumentRow.tsx`** — confirm the `upload_source='packet_intake'` rendering path exists (lifecycle PRD). Extend if not.
11. **`lib/memberFilter.ts`** — `matchesMemberFilter()` and `getApplicableMembers()`. Consumed by the seeding primitive and by person-slot detection in the classifier.
12. **`lib/auth.ts`**, **`lib/audit.ts`**, **`lib/supabase.ts`** — session, audit, admin-client patterns.
13. **An existing Vitest test file** — match the test pattern.

---

## Closed decisions (do not relitigate)

Per PRD section "Closed decisions":

1. OCR provider: Claude API vision. Confirm env var names, model, rate limits exist. If missing, stop and report.
2. New parallel intake tables (`intake_batches`, `intake_pages`, `doc_type_signatures`). Existing `scan_batches` / `scan_extractions` untouched.
3. UI route PBV-specific, API generic.
4. Anchor: polymorphic `(anchor_type, anchor_id)`. PBV writes `'pbv_full_application'`.
5. Document writes target `application_documents`. **Never `form_submission_documents`.**
6. Storage staging bucket: form-agnostic `intake-staging/`.
7. Templates remain `form_document_templates` keyed by `form_id`.

---

## Decisions still open — confirm before coding the affected phase

Per PRD section "Open questions for Windsurf":

1. **Revision contract on `application_documents`.** Read PRD-01's migration and confirm the unique constraint and revision semantics. Candidate: `(anchor_type, anchor_id, doc_type, person_slot, revision)`. Post your read in chat before coding the commit endpoint in Phase 5.
2. **OCR env vars.** Verify presence and report names before Phase 3. Stop if missing.
3. **`upload_source='packet_intake'` enum membership.** Confirm PRD-01 added it on `application_documents`. If not, extend the CHECK constraint here.

---

## Build this pass

Six phases per PRD section "Implementation Phases." Do not skip, merge, or reorder.

### Phase 1 — Intake substrate

Create migration `supabase/migrations/<ts>_packet_intake_substrate.sql` with:
- `intake_batches`, `intake_pages`, `doc_type_signatures` tables exactly per PRD data model section.
- `IF NOT EXISTS` throughout.
- RLS enabled, service_role full access policy.
- Indexes per PRD.
- Rollback comment at top.
- `doc_type_signatures` seeded for every PBV doc_type from `form_document_templates WHERE form_id='pbv-full-application'`. Patterns per PRD section 3.

Extract `app/api/admin/scan-upload/route.ts`'s PDF-splitting logic into `lib/scan/splitPdf.ts`. Existing scan-upload route imports the new helper. Verify existing scan-upload tests still pass.

**Done when:**
- Tables exist with correct shape, indexes, constraints, RLS.
- `doc_type_signatures` seeded for every PBV doc_type.
- Existing scan-upload tests pass.

### Phase 2 — Upload endpoint

Create `POST /api/admin/intake/[anchor_type]/[anchor_id]/upload`:
- Authenticates as Stanton user.
- Accepts multipart form-data with one or more files (PDF, JPG, PNG, HEIC).
- Creates an `intake_batches` row with `anchor_type`, `anchor_id`, `status='uploading'`, `created_by_user_id=<current>`.
- For each file, splits into per-page images using `lib/scan/splitPdf.ts` (PDF) or `sharp` (image conversion to JPG for HEIC; normalize JPG/PNG to JPG).
- Saves each page to Supabase Storage at `intake-staging/{batch_id}/{global_index}.jpg`.
- Inserts `intake_pages` rows with `image_path` set, OCR fields null at this stage.
- Updates `intake_batches.total_pages`, sets `status='classifying'`.
- Returns the batch ID.

**Done when:**
- 30-page test PDF round-trips end-to-end: upload → 30 page rows → 30 image files in `intake-staging`.
- Mixed batch (1 PDF + 3 JPG + 1 HEIC) produces the right number of pages, all images JPG.
- Existing scan-upload tests still pass.

### Phase 3 — OCR + classifier

Create `lib/intake/ocr.ts` calling Claude API vision. Returns `{ text: string, confidence: 'high' | 'medium' | 'low' | 'none' }` for a given page image. Confidence derived from response heuristics, not provided by the API directly. Model name and rate limits from env vars.

Create `lib/intake/classifier.ts`:
- Loads `doc_type_signatures` for the relevant `form_id` once and caches.
- `classifyPage(text, householdMembers): { suggested_doc_type, suggested_person_slot, suggested_score, ocr_confidence }`.
- Scoring per PRD section 3. Confidence buckets per PRD.
- Person-slot detection: scan extracted text for each member's last name + first initial. Exactly one match → suggest that slot. Zero or multiple → no suggestion.

Extend the upload endpoint to call OCR + classification synchronously per page. Populates `extracted_text`, `suggested_doc_type`, `suggested_person_slot`, `suggested_score`, `ocr_confidence` on `intake_pages`.

Add fixture set: `__tests__/fixtures/intake-packets/` containing ≥10 sample pages covering canonical doc types (synthesize or ask Alex for samples). Test runs OCR + classifier against fixtures, asserts ≥80% correct doc_type suggestions at high or medium confidence.

**Done when:**
- Fixture test passes the ≥80% threshold. Report actual pass rate.
- Person-slot detection correct for any fixture naming a single member.
- OCR provider error → page still inserted with `ocr_confidence='none'`; batch not blocked.

### Phase 4 — Classify UI

Create route `/admin/pbv/full-applications/[id]/intake` at `app/admin/pbv/full-applications/[id]/intake/page.tsx`. The route resolves `form_submission_id`'s replacement — the application's `id` becomes `anchor_id`, `anchor_type='pbv_full_application'`. The route is PBV-specific; the API it calls is generic.

Implement three phases (Upload → Classify → Commit) per PRD section 2.

Classify UI requirements:
- Two-column layout: pages on the left, target document rows + Custom + Discard on the right.
- Each page thumbnail shows: page number, source filename, OCR-suggested `doc_type` with confidence badge (high=green, medium=yellow, low=gray, none=neutral), suggested `person_slot` if any.
- Drag-and-drop via native HTML5 drag API or `@dnd-kit/core` (only if not already in `package.json` — do not introduce a new drag library if one is already there).
- Multi-select (shift-click) for multi-page document grouping.
- "Custom" target with on-drop label prompt.
- "Discard" target for blank pages / separators.
- Commit button disabled while any pages unassigned (discards count as explicit).
- Assignment state persists to `intake_pages.staged_assignment` JSONB on every interaction.

Add the **"Intake Packet"** button to `components/review/StantonReviewSurface.tsx` toolbar linking to the new route.

**Done when:**
- Manual test: staff user classifies a 20-page batch end-to-end without losing work after refresh.
- All assignments persist across reload.
- Custom prompts for and accepts a label.
- Discard target removes pages from unassigned count without committing.

### Phase 5 — Commit + audit

Create `POST /api/admin/intake/[anchor_type]/[anchor_id]/commit/[batch_id]`:
- Runs in a single DB transaction.
- For each grouped assignment: insert an `application_documents` row (or new revision per PRD-01's versioning model) with `anchor_type='pbv_full_application'`, `anchor_id=<id>`, `uploaded_by_role='staff'`, `uploaded_by_display_name=<current>`, `upload_source='packet_intake'`, `staff_upload_note=<batch label if provided>`.
- For Custom: insert with `doc_type='custom'`, `required=false`, `requires_signature=false`, label from staff input, `display_order=MAX+10`, `original_doc_type=null`.
- Moves storage files from `intake-staging/{batch_id}/...` to `pbv-documents/{application_id}/{document_id}/{revision}.{ext}` **after** the DB transaction commits.
- Writes `application_events` rows: one `document_uploaded` per committed doc, one `packet_intake_committed` summary.
- Marks `intake_batches.status='committed'`, sets `committed_at` and `committed_document_count`.
- On any DB transaction failure: rolls back, batch status untouched, no storage moves attempted.
- On a storage-move failure post-DB-commit: logs the failure, marks the affected document with a retry flag (define a column on `intake_pages` or a separate `intake_storage_retries` table — document the choice in the build report).

Confirmation modal in the UI before commit:
- Total pages assigned.
- Breakdown: N pages → M template docs, K pages → L custom docs, P pages → discarded.
- Person-slot summary.

After commit, redirect to `/admin/pbv/full-applications/[id]` (the review surface).

Update `StantonReviewSurface` to render `doc_type='custom'` rows in a separate visual group ("Additional Documents") below standard categories. Confirm they do not count toward the `Docs Approved` tile or the Send-to-HACH gate.

**Done when:**
- Committing a packet produces exactly the expected `application_documents` rows and revisions.
- Rollback test: force a storage failure mid-commit. DB and storage end consistent.
- `application_events` shows expected entries.
- Custom docs in their own group; completeness counter and Send-to-HACH gate unchanged.
- `intake_batches.status` transitions correct.
- **Grep audit:** zero references to `form_submission_documents` in any new code from this build.

### Phase 6 — Polish

- Empty states for every phase.
- Error states: OCR provider failure, storage failure, unauthorized access, batch belongs to a different application.
- Packet History expander on the intake route: prior batches for this application with status, page count, committed doc count, timestamp.
- `scripts/cleanup-abandoned-intake-batches.ts` that deletes staging files for batches in `abandoned` or `committed` status older than 7 days. Alex schedules via Vercel cron after merge.

---

## Tech constraints

- Next.js App Router
- Supabase admin client with service_role (existing `lib/supabase.ts` pattern)
- iron-session via `lib/auth.ts`
- TypeScript strict — no `any` in new code
- Vitest for tests
- `pdfjs-dist`, `sharp`, `pdf-lib` — already in bundle, reuse
- Do not introduce new libraries except:
  - OCR provider client if Claude API choice requires one
  - `@dnd-kit/core` only if no drag library is already present in `package.json`
- `gen_random_uuid()` for IDs
- Migrations idempotent (`IF NOT EXISTS`)

---

## Hard NOs

- **Do NOT write to `form_submission_documents` from any code path in this build.** PBV documents go to `application_documents`. If you find existing code that still writes to `form_submission_documents` for PBV, that's a PRD-01 bug — flag it and stop, do not work around it.
- **Do NOT modify the existing `scan_batches` / `scan_extractions` tables.** Different domain.
- **Do NOT collapse seeding into the API route.** The seeding primitive from PRD-01 (`seedDocumentsForApplication`) is the single source of truth.
- **Do NOT make custom documents count toward the required-doc completeness counter.** They are intentionally outside that tally. The `Docs Approved: N/N req` math operates on `required=true` rows only — verify your changes preserve that.
- **Do NOT block Send-to-HACH on custom documents.** Same reasoning.
- **Do NOT auto-classify pages to person slots without OCR evidence.** Slot suggestions only when exactly one member's name appears. Otherwise null; staff classifies manually.
- **Do NOT auto-commit OCR suggestions.** Suggestions are pre-fills, not assignments. Staff confirms explicitly.
- **Do NOT skip the staging→final storage move pattern.** Pages live in staging until commit. Committed pages move to canonical path. Non-negotiable for rollback semantics.
- **Do NOT add an FK from `intake_batches.anchor_id` to any specific table.** Polymorphic; application-enforced.
- **Do NOT add placeholder code or TODOs.**
- **Do NOT auto-fix unrelated bugs** — note them under "Pre-existing issues observed" in the build report.
- **Do NOT skip the verification phase.**

---

## Verification phase (mandatory)

End-to-end checks. Skipping any of these means the task is not complete.

*Save-path test standards (harness setup, no-mocks rule, helper-throws rule, drift check): see `docs/verification-methodology_2026-05-13.md`.*

1. **Migrations apply clean.** No errors. All three new tables exist with correct constraints. `doc_type_signatures` seeded.
2. **`npm run build` succeeds.** Zero errors.
3. **TypeScript strict.** No new `any`, no implicit returns.
4. **`npm test` passes.** Every new test green. Existing tests untouched and green.
5. **Upload end-to-end.** 30-page PDF → 30 `intake_pages` rows → 30 image files in `intake-staging`. Mixed-file batch verified.
6. **Real packet walkthrough.** Prepare or obtain a test packet with at least:
   - 4 pages of paystubs
   - 2 pages of a bank statement
   - 1 HUD-9886-A signed
   - 1 HACH Release signed
   - 1 court order (not on template — must land as Custom)
   - 1 blank page (must land as Discard)

   Document each phase:
   - Upload: file count, total pages, batch ID
   - Classify: OCR confidence per page, suggested doc_type per page, suggested slot per page, what you accepted vs. corrected
   - Commit: confirmation modal contents, final `application_documents` rows inserted (paste DB result), `application_events` rows written (paste)
   - Custom court order in "Additional Documents" group
   - `Docs Approved: N/N req` tile does not count the court order
   - Discarded blank page absent from any committed table

7. **Rollback test.** Force a storage failure during commit. Confirm:
   - No `application_documents` rows created.
   - No `application_events` written.
   - `intake_batches.status` did not transition to `committed`.
   - Pages remain in staging storage.

8. **Resume test.** Mid-classify, kill the browser. Reopen the intake route. All previous assignments preserved exactly.

9. **Cross-application isolation.** Confirm batch IDs from one application cannot be committed against a different application. Construct the malicious request manually. Expect 403 or 404.

10. **OCR fixture test ≥80% pass rate.** From Phase 3. Document actual pass rate.

11. **Anchor leakage check.** Grep `form_submission` and `form_submission_id` across new code paths from this build. Zero hits (excluding unrelated legacy code untouched by this build). Particularly: zero matches in `lib/intake/*`, `app/api/admin/intake/**`, `app/admin/pbv/full-applications/[id]/intake/**`, or in any modified path within `StantonReviewSurface` / `DocumentRow`.

12. **Storage cleanup script.** Manual run against a test set with staging files older than 7 days. Verifies correct deletion behavior on `committed` and `abandoned` batches; leaves recent batches alone.

If any of 1–12 fails, **do not declare done.** Stop, report, await instruction.

---

## Build report requirements

Create `docs/build-reports/pbv-02-packet-intake-build-report_2026-05-14.md`:

1. **Pre-build decisions.** OCR provider env vars confirmed. Revision contract read from PRD-01. Storage-retry mechanism choice (column vs separate table).
2. **Migrations.** File path, applied Y/N, `\d` output for each table, seeded `doc_type_signatures` count by doc_type.
3. **PRD goals checklist.** Every Goal with `[x]` or `[ ]` and a one-line note.
4. **Files created.** One-line description each.
5. **Files modified.** Summary of changes per file.
6. **Test results.** Full Vitest output. Per-phase acceptance criteria. OCR fixture pass rate (exact percentage).
7. **Real packet walkthrough log.** Phase-by-phase results for verification item 6. Include DB row dumps, event dumps, screenshots if practical.
8. **Rollback test result.** Verification item 7. Document forced-failure mechanism and observed state.
9. **End-to-end save verification.** For each write endpoint: payload, SQL verification query, result.
10. **Cross-app isolation matrix.** Verification item 9 + any other security checks.
11. **Anchor leakage grep audit.** Verification item 11 results.
12. **Deviations from PRD.** Reasoning. Empty if none.
13. **Pre-existing issues observed.** Anything broken/risky out of scope. Do not fix.
14. **Verification phase results.** Items 1–12 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report file length (lines), section count, confirmation every section is populated.
- Verification items 1–12 pass/fail.
- OCR fixture pass rate.
- Real packet walkthrough — all 12 verification items end-to-end success.
- Anchor leakage grep result (must be zero).
- Anything that blocked you.

If any test fails, any verification item fails, or any check returns the wrong status, do not declare complete. Leave the task in progress and stop.
