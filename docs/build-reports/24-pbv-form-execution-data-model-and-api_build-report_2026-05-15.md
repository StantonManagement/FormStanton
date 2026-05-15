# PRD-24 Build Report — PBV Form Execution: Data Model + API

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**PRD:** `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md`
**Tests:** 35 passed, 1 skipped (stamper byte-test skips when running without full source PDFs)

---

## Deliverables

### Commit 1 — DB Schema (5 migrations)

| Migration file | What it does |
|---|---|
| `20260515000000_pbv_form_execution_columns.sql` | Adds 10 columns to `pbv_full_applications` (intake_data, intake_status, signing_status, submission_language, timestamp columns), 3 columns to `pbv_household_members` (signing_device, magic_link_token, magic_link_expires_at). All additive. |
| `20260515010000_pbv_form_documents.sql` | Creates `pbv_form_documents` — one row per (application × form_id × language). Unique constraint, RLS, trigger. |
| `20260515020000_pbv_signature_events.sql` | Creates `pbv_signature_events` — audit trail for per-form signing taps. One row per (signer × form × ceremony). Unique constraint, RLS. |
| `20260515030000_pbv_summary_documents.sql` | Creates `pbv_summary_documents` — one row per application for the summary doc gate. Unique on application_id. RLS, trigger. |
| `20260515040000_pbv_form_templates.sql` | Creates and seeds `pbv_form_templates` — 17 rows, 13 with `generation_enabled=TRUE`, 4 with `generation_enabled=FALSE`. |

**Apply with:**
```
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-prd24-migrations.mjs
```

### Commit 2 — TypeScript Library (4 modules, 4 test files)

| File | Purpose |
|---|---|
| `lib/pbv/form-generation/stamper.ts` | Server-side TS port of `scripts/stamp-form.mjs`. Accepts field map + data + source PDF bytes → returns stamped PDF Buffer. Supports `fields`, `row_patterns`, and `row_pattern`. No shell-out. |
| `lib/pbv/form-generation/field-mapping.ts` | Per-form resolvers: translates `intake_data` + member roster → stamper field_data. Handles all 13 enabled forms with correct HOH/adult/minor splitting, SSN masking, date formatting. |
| `lib/pbv/form-generation/source-pdfs.ts` | Loads source PDFs from `docs/templates/` at startup. `tryLoadPdf()` returns null if file absent (generation skips gracefully). `sha256Hex()` for source_pdf_hash. |
| `lib/pbv/conditional-rules.ts` | 8 per-form rule predicates + 2 per-section predicates. Single `shouldGenerateForm(conditionalRule, intakeData, members)` dispatcher. Unknown rules default to `true` with a console.warn. |
| `lib/pbv/form-templates.ts` | Typed access to `pbv_form_templates` rows. `getEnabledFormTemplates()`, `getFormTemplate()`, `getAllFormTemplates()`. |
| `lib/pbv/__tests__/stamper.test.ts` | 3 tests: byte-valid PDF output, empty data no crash, row_patterns no crash. Skips when source PDF absent. |
| `lib/pbv/__tests__/conditional-rules.test.ts` | 20 tests: all rule predicates, section predicates, mutual exclusion. |
| `lib/pbv/__tests__/field-mapping.test.ts` | 8 tests: main_application (adults/minors split, SELF/YO), obligations_of_family, citizenship_declaration, hud_9886a (SSN masking), briefing_cert, unknown form. |
| `lib/pbv/__tests__/form-templates-seed.test.ts` | 5 tests: static SQL parse → verifies 17 rows, 13 TRUE, 4 FALSE, zero_income_statement=FALSE. No DB required. |

### Commit 3 — API Routes (11 new routes)

| Route | Method | Notes |
|---|---|---|
| `/api/t/[token]/pbv-full-app/intake/[section]` | POST | Section save → merges into intake_data, idempotent |
| `/api/t/[token]/pbv-full-app/intake/complete` | POST | Marks intake_status=complete, validates required sections |
| `/api/t/[token]/pbv-full-app/generate-forms` | POST | Evaluates conditional rules, stamps PDFs, uploads to Storage, upserts form_documents rows |
| `/api/t/[token]/pbv-full-app/forms` | GET | Lists form documents with signing progress |
| `/api/t/[token]/pbv-full-app/forms/[id]/preview` | GET | 60-second signed URL for PDF preview |
| `/api/t/[token]/pbv-full-app/signature/capture` | POST | Uploads signature PNG to Storage, returns path |
| `/api/t/[token]/pbv-full-app/sign-summary` | POST | Signs summary doc, sets signing_status=summary_signed |
| `/api/t/[token]/pbv-full-app/sign-form` | POST | Per-form tap — inserts signature_event, stamps signed PDF when all signers complete |
| `/api/t/[token]/pbv-full-app/additional-signers` | GET | Non-HOH adults with signing status and magic link state |
| `/api/t/[token]/pbv-full-app/additional-signers/[id]/send-link` | POST | Generates magic_link_token (30d TTL), idempotent |
| `/api/t/[token]/pbv-full-app/resume` | POST | Rate-limited (60min) resume SMS re-send stamp |

---

## Key decisions made during build

### Decision 1 — Created `pbv_form_templates` as a new table
`form_document_templates` serves the upload-slot seeding pipeline (`application_documents`). Creating a parallel `pbv_form_templates` avoids overloading an existing table with generation-specific concerns. Both coexist.

### Decision 2 — `generation_enabled` not reset on migration re-runs
The `pbv_form_templates` seed uses `ON CONFLICT DO UPDATE` but deliberately excludes `generation_enabled` from the UPDATE SET. Re-applying the migration never accidentally disables a form that was manually enabled after a source PDF landed.

### Decision 3 — `zero_income_statement` stays `generation_enabled=FALSE`
Source PDF was absent in PRD-23. Confirmed FALSE per PRD plan. Flip to TRUE once field map is verified against the actual source PDF.

### Decision 4 — Summary signing does not create a `pbv_signature_events` row
`pbv_signature_events` requires a `form_document_id` FK (references `pbv_form_documents`). The summary document is tracked in `pbv_summary_documents` which has its own `signed_at` and optional `signature_event_id`. The FK is nullable — summary signing is recorded directly. A future PRD can create a synthetic `pbv_form_documents` row for the summary if full audit trail parity is needed.

### Decision 5 — `uuid` package not used; `crypto.randomUUID()` used instead
`uuid` is not in `package.json`. Node 18+ / Next.js App Router provides `crypto.randomUUID()` built-in.

### Decision 6 — `require('fs')` inside API route helpers
`source-pdfs.ts` is a module-level import using `readFileSync`. Route handlers for `generate-forms` and `sign-form` use inline `require('fs')` for the field-map loader to avoid issues with Next.js bundling of `fs` in Edge runtime contexts. These routes are Node.js API routes only.

---

## Anti-patterns avoided

- ✅ No shell-out to `stamp-form.mjs` from API routes
- ✅ No base64 signature images stored in DB (Storage path stored, not bytes)
- ✅ No existing columns dropped or renamed
- ✅ `generation_enabled` not flipped prematurely for source-pending forms
- ✅ All POST endpoints are idempotent via `withTenantContext` + `withIdempotency`
- ✅ `pbv_form_templates` seeded separately from `form_document_templates`

---

## Storage buckets required

Two new Supabase Storage buckets must be created before `generate-forms` or `signature/capture` can succeed:

| Bucket | Purpose | Visibility |
|---|---|---|
| `pbv-forms` | Unsigned + signed stamped PDFs | Private (signed URLs only) |
| `pbv-signatures` | Tenant signature images (PNG/JPEG) | Private |

Create via Supabase dashboard or:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('pbv-forms', 'pbv-forms', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('pbv-signatures', 'pbv-signatures', false);
```

---

## Pending (outside PRD-24 scope)

- PRD-25: Phase 1 intake UI — reads `intake_data`, calls `intake/[section]` and `intake/complete`
- PRD-26: Phase 2 review + sign UI — calls `generate-forms`, `forms`, `sign-summary`, `sign-form`
- PRD-27: Phase 3 additional adults — calls `additional-signers`, `send-link`, magic-link token route
- Storage bucket policies (RLS on Storage) — needed before any PDF upload works
- `vawa_certification`, `reasonable_accommodation_request`, `zero_income_statement`, `eiv_guide_receipt` source PDFs — flip `generation_enabled=TRUE` once sourced + field-mapped

---

## Test run summary

```
Test Files  4 passed (4)
Tests       35 passed | 1 skipped (36)
Duration    ~1.2s
```

Skipped test: `stampForm > produces a valid PDF for briefing-cert-en` — skips when running without `docs/templates/briefing-cert-en.pdf` present in CI. Passes locally with source PDFs.
