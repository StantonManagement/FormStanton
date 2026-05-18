# Cursor/Windsurf Prompt — PRD-24: Data Model + API

## Context

This pass lays the schema and API surface for the PBV Form Execution build. Everything PRD-25 (intake UI), PRD-26 (review-and-sign UI), and PRD-27 (additional-adults UI) consume lives here.

This is additive on a working PBV stack: `pbv_full_applications`, `pbv_household_members`, `application_documents`, `pbv_full_app_document_templates`, and the `/api/t/[token]/pbv-full-app/*` route tree all exist. Do not duplicate; extend in place.

## Required reading before you start

1. `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` — this PRD
2. `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md` — architecture overview (§4 data model, §5 form generation pipeline, §6 save-and-resume)
3. `docs/fullApp-Plan/pbv-field-inventory.md` — `prefill_source` column, `Conditional Trigger Reference` section, `Form-level gating rules`
4. `supabase/migrations/20260423210000_pbv_full_application_tables.sql` — current `pbv_full_applications` + `pbv_household_members` schemas
5. `supabase/migrations/20260424110000_pbv_household_members_documented_income.sql` — household members extension
6. `supabase/migrations/20260514120000_application_documents.sql` — uploads pipeline you'll integrate with
7. `lib/idempotency.ts` + `supabase/migrations/20260514230000_tenant_idempotency_keys.sql` — idempotency convention from PRD-19
8. `scripts/stamp-form.mjs` — the logic you're porting to TypeScript
9. The 24 field maps from PRDs 22 + 23 in `scripts/field-maps/` — the data format your TS port has to consume
10. Existing route handlers under `app/api/t/[token]/pbv-full-app/` — to see the conventions for tenant-scoped routes (idempotency wrapper, error shape, etc.)

## Closed decisions (do not relitigate)

- Additive Variant A. `pbv_full_applications` is the parent table. Add columns; don't replace.
- `tenant_access_token` is the resume token. No new token column.
- `pbv_signature_events` is a NEW table, parallel to `signature_capture_audit` (which serves post-approval signing). Don't overload either.
- 4 source-pending forms have `generation_enabled = FALSE` by default. `zero_income_statement` flag depends on whether PRD-23 mapped it.
- One signature image captured, per-form tap-to-confirm = one `pbv_signature_events` row per form per signer.
- Summary doc must be signed before any federal form can be signed.
- All POST endpoints accept `Idempotency-Key` header.
- Server-side stamping is a TS port of `stamp-form.mjs`, not a shell-out.

## Decisions still open — pick during build, document in build report

- **Extend `pbv_full_app_document_templates` OR create `pbv_form_templates`.** Look at the existing template table first. If its columns can hold `generation_enabled`, `source_pdf_status`, `per_person_scope`, `conditional_rule` without distorting its purpose, extend. Otherwise create. Document choice in build report.
- **Signature image storage path scheme.** Suggested in PRD; confirm against existing PBV storage conventions in `lib/signing/storage.ts` and friends.
- **`signature_image_ref` lifetime** from `signature/capture` (suggest 60 min).
- **Whether to merge `pbv_summary_documents` into `pbv_form_documents` with `form_id = 'summary_doc'`.** Pro: one less table. Con: summary doc has language `pt` which federal forms don't. Default: keep separate as in the PRD.

## Build this pass

### Commit 1 — Migrations

Write in dependency order:

1. `supabase/migrations/{stamp}_pbv_form_execution_columns.sql`
   - ALTER `pbv_full_applications` ADD COLUMNs per PRD §1
   - ALTER `pbv_household_members` ADD COLUMNs per PRD §2
2. `supabase/migrations/{stamp}_pbv_form_documents.sql`
3. `supabase/migrations/{stamp}_pbv_signature_events.sql` (FKs to pbv_form_documents and pbv_household_members)
4. `supabase/migrations/{stamp}_pbv_summary_documents.sql`
5. `supabase/migrations/{stamp}_pbv_form_templates.sql` — schema + seed of 17 rows
6. Optional: `supabase/migrations/{stamp}_pbv_form_execution_doc_type_seed.sql` — only if `application_documents.doc_type` needs new slug seed rows

Apply locally. Smoke-test on fresh DB.

Commit: `feat(pbv-form-execution): db schema for form documents, signatures, summary, templates`.

### Commit 2 — TypeScript library

Files:
- `lib/pbv/form-generation/stamper.ts` — port of `scripts/stamp-form.mjs`. Same input contract (field map + data + source PDF path). Returns a Buffer. Add a unit test that asserts byte-identical output against the briefing-cert pilot.
- `lib/pbv/form-generation/field-mapping.ts` — typed lookup table mapping inventory `field_name` keys to a resolver function over (intake_data, members). Derive the structure from `pbv-field-inventory.md` — write a small build-time script (or just code by hand) that walks the inventory and produces the mapping.
- `lib/pbv/form-generation/source-pdfs.ts` — module that loads source PDFs from `docs/templates/`. PDF bytes embedded at deploy time (read at build, not at request — performance + reliability).
- `lib/pbv/conditional-rules.ts` — predicates: `shouldGenerateForm(formId, intakeData, members)`, `shouldRenderSection(sectionKey, intakeData, members)`, `isMutuallyExclusivePair(...)`.
- `lib/pbv/form-templates.ts` — typed access to `pbv_form_templates`.

Unit tests for each:
- `lib/pbv/__tests__/stamper.test.ts`
- `lib/pbv/__tests__/field-mapping.test.ts`
- `lib/pbv/__tests__/conditional-rules.test.ts`
- `lib/pbv/__tests__/form-templates.test.ts`

Commit: `feat(pbv-form-execution): server-side stamping, field mapping, conditional rules`.

### Commit 3 — Intake API

- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` POST handler
  - Auth via tenant_access_token
  - Idempotency via header
  - Validates section payload shape; merges into `intake_data` jsonb
  - Sets `intake_status = 'in_progress'` on first call; sets `intake_started_at` if null
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` POST handler
  - Validates required sections present
  - Sets `intake_status = 'complete'`, `intake_completed_at = now()`
  - Returns next-step pointer
- Modify `app/api/t/[token]/pbv-full-app/route.ts` GET to include `intake_status`, `signing_status`, `preferred_language`, `submission_language`

Commit: `feat(pbv-form-execution): intake save + complete API`.

### Commit 4 — Form generation API

- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` POST
  - Idempotent
  - For each form_template row with `generation_enabled = TRUE` whose `conditional_rule` matches the application, stamp and persist
  - Returns list of generated form_document IDs
- `app/api/t/[token]/pbv-full-app/forms/route.ts` GET — lists pbv_form_documents for this app
- `app/api/t/[token]/pbv-full-app/forms/[form_document_id]/preview/route.ts` GET — Supabase signed URL for the unsigned or in-progress PDF

Commit: `feat(pbv-form-execution): form generation API`.

### Commit 5 — Signing API

- `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` POST
  - Stores signature image in storage
  - Returns `signature_image_ref` (token tied to image, valid 60 min)
  - One per ceremony
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` POST
  - Captures signature event on the summary doc
  - Required before any federal-form `sign-form` call
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts` POST
  - Body: `form_document_id`, `signer_member_id`, `typed_name`, `signature_image_ref`, `ceremony_id`, `consent_text_version`
  - Validates summary doc signed
  - Validates signer in required signers
  - Loads unsigned PDF, stamps signature at signer's coordinate, writes signed/in-progress PDF
  - Inserts `pbv_signature_events` row with document_hash
  - Updates `pbv_form_documents.collected_signer_member_ids` and `status` if all signers complete
- Modify `app/api/t/[token]/pbv-full-app/finalize/route.ts` to verify all required signatures captured before finalizing

Commit: `feat(pbv-form-execution): signing API with per-form events`.

### Commit 6 — Additional-signer + resume API

- `app/api/t/[token]/pbv-full-app/additional-signers/route.ts` GET — lists non-HOH adults, their sign status, their personal magic_link_token if set
- `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts` POST
  - Generates `magic_link_token` (use `lib/generateToken.ts`)
  - Sets `magic_link_expires_at = now() + 30 days`
  - Sends SMS (stub for now; PRD-04 had Twilio in progress, leave the integration point clean)
- `app/api/t/[token]/pbv-full-app/resume/route.ts` POST — re-send the application magic link, rate-limited via `resume_token_last_sent_at`

Commit: `feat(pbv-form-execution): additional-signer magic links + resume API`.

### Commit 7 — Tests + verification

- All unit tests passing
- `lib/__tests__/schema-contract.test.ts` extended to cover the 5 new tables
- `npm run build` clean (PowerShell, full output — no `Select-Object` truncation)
- TypeScript `noEmit` passes

Commit: `test(pbv-form-execution): schema contract + library unit tests`.

## Verification

After each commit:
- Migrations apply cleanly on a fresh local DB
- New routes return correctly shaped responses against curl/postman happy-path
- Unit tests for the libraries you touched pass

After all commits:
- Full `npm run build` succeeds without truncation
- `npm test` (vitest) passes
- DB has 17 rows in `pbv_form_templates`
- A simulated walkthrough (curl or REST client) can: start intake → save 3 sections → mark complete → generate forms → capture signature → sign summary → sign one federal form → check forms list shows correct status

## Anti-patterns — do NOT

- Do not drop or rename existing columns on `pbv_full_applications` or `pbv_household_members`
- Do not create a parallel applications table
- Do not duplicate `signature_capture_audit` purpose in `pbv_signature_events` — they live alongside, each scoped
- Do not shell out to `scripts/stamp-form.mjs` from API routes — port the logic to TS
- Do not skip idempotency on POSTs
- Do not flip `generation_enabled = TRUE` for source-pending forms
- Do not implement any UI (PRD-25/26/27)
- Do not author summary doc content (PRD-28)
- Do not use `npm run build | Select-Object -First/-Last N` — known false-negative per repo standing rules
- Do not store signature images as base64 in DB rows — Supabase Storage with a path reference

## Build report (you write this)

`docs/build-reports/24-pbv-form-execution-data-model-and-api-build-report_2026-05-15.md`:

1. **Migrations shipped** — file list + brief description of each
2. **Library modules shipped** — file list + responsibility
3. **API routes shipped** — endpoint list with one-line description
4. **Open-decision resolutions** — your call on templates table approach, storage paths, signature_image_ref lifetime
5. **Stamper regression** — confirmation that the TS port produces byte-identical output to the JS pilot
6. **Test coverage** — what's covered, what's not
7. **Build output** — confirm clean `npm run build` and `npm test`
8. **Open questions for Alex** — flag anything that came up
9. **Recommendations for PRD-25** — anything you noticed about the intake schema while building the API that should inform the UI PRD

## When you're done

- All 7 commits on `feature/pbv-form-execution` branch
- Build report committed
- Schema migrations apply on fresh DB
- All tests pass
- Clean working tree
- Surface report path to Alex and wait for sign-off before PRD-25
