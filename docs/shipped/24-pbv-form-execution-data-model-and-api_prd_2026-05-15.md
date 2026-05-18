# PRD-24 — PBV Form Execution: Data Model + API

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md`, `docs/fullApp-Plan/pbv-field-inventory.md`
**Depends on:** PRD-23 complete (field maps for all sourced forms)

---

## Problem Statement

The PRDs that follow (25 Phase-1 intake UI, 26 Phase-2 review-and-sign, 27 Phase-3 additional-adults) all read and write against the same underlying state: tenant intake answers, generated stamped PDFs, per-form signature events, the signed summary doc. This PRD lays the schema and the API surface that those PRDs consume.

Three constraints:

1. **Must be additive on existing PBV schema.** `pbv_full_applications`, `pbv_household_members`, `application_documents`, `pbv_form_templates`, and the existing tenant magic-link token already exist. Don't drop, don't duplicate; extend in place.
2. **Form generation must be feature-flaggable per form.** The 5 source-pending forms (VAWA, Reasonable Accommodation, healthcare-provider-release, childcare-expense-verification, zero_income_statement) have field-map placeholders or `[Unverified]` entries but their generation must be off by default until source PDFs land and field maps are confirmed.
3. **Audit trail per signature event.** One row per (signer × form × signing-ceremony) capturing typed name, signature image, IP, user agent, timestamp, document hash, and device-owner flag.

## Evidence baseline (verified 2026-05-15)

- `pbv_full_applications` exists (migration `20260423210000`). Has `tenant_access_token`, `dv_status`, `homeless_at_admission`, `claiming_medical_deduction`, `has_childcare_expense`, `reasonable_accommodation_requested`, `stanton_review_status`. No language fields, no intake_data, no resume expiration.
- `pbv_household_members` exists (migration `20260423210000`, extended `20260424110000`). Has `signature_required`, `signature_image`, `signature_date`, `signed_forms text[]`, `disability`, `student`, `citizenship_status`, `documented_income`, per-income-source booleans. Per-adult signature tracking is already partially modeled here.
- `application_documents` exists (migration `20260514120000`). This is the upload pipeline that the trigger_upload column in the inventory targets.
- `pbv_full_app_document_templates` exists (migration `20260423220000`). Source of doc-template metadata; the new form-templates table either lives here or alongside.
- Existing `/api/t/[token]/pbv-full-app/*` route tree handles documents/, finalize/, signatures/, signer-completed/, action-items/.
- Existing `/api/tenant/signing/[token]/[signatureId]/*` handles consent/, apply/, identity/, document-reviewed/. The post-approval signing build (PRD-04) created this surface.
- `signature_capture_audit` table exists (per CURRENT_STATE.md). It serves the post-approval signing flow; we may extend it rather than create a parallel table.

## Key decisions

### 1. Variant A additive on `pbv_full_applications`

ALTER `pbv_full_applications` to add:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `preferred_language` | TEXT | `'en'` | UI language. Values: `'en' \| 'es' \| 'pt'`. |
| `submission_language` | TEXT | `'en'` | Federal forms language. Values: `'en' \| 'es'`. PT-speakers default to `'es'`. |
| `intake_data` | JSONB | `'{}'` | Single source of truth for tenant intake answers, structured per PRD-25 schema. |
| `intake_status` | TEXT | `'not_started'` | Values: `'not_started' \| 'in_progress' \| 'complete'`. Distinct from `stanton_review_status`. |
| `signing_status` | TEXT | `'not_started'` | Values: `'not_started' \| 'summary_signed' \| 'in_progress' \| 'complete'`. |
| `intake_started_at` | TIMESTAMPTZ | NULL | First tenant interaction. |
| `intake_completed_at` | TIMESTAMPTZ | NULL | When tenant finished Phase 1. |
| `signing_completed_at` | TIMESTAMPTZ | NULL | When all required signatures captured. |
| `submitted_to_hach_at` | TIMESTAMPTZ | NULL | When submitted to HACH (separate from `submitted_at` if it already exists; reuse if present). |
| `resume_token_expires_at` | TIMESTAMPTZ | NULL | When `tenant_access_token` becomes invalid. |
| `resume_token_last_sent_at` | TIMESTAMPTZ | NULL | For rate-limiting SMS re-sends. |

`tenant_access_token` is the resume token. No new token column.

### 2. Extend `pbv_household_members` minimally

The existing schema covers most needs. Two additions:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `signing_device` | TEXT | `'unknown'` | When this member signs, was it on their own device or on HOH's? Values: `'self' \| 'hoh_device' \| 'staff_assisted' \| 'unknown'`. Populated at sign time, not at intake. |
| `magic_link_token` | TEXT UNIQUE NULL | NULL | Per-adult magic link for Phase 3 fallback. Only populated when HOH chooses "send them their own link". |
| `magic_link_expires_at` | TIMESTAMPTZ | NULL | 30 days from generation. |

### 3. New table — `pbv_form_documents`

One row per (application × form_id × language). Holds the path to the unsigned and signed stamped PDFs.

```sql
CREATE TABLE public.pbv_form_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id   UUID NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  form_id               TEXT NOT NULL,              -- e.g. 'briefing_docs_certification', 'main_application'
  language              TEXT NOT NULL,              -- 'en' | 'es'
  status                TEXT NOT NULL DEFAULT 'pending_generation'
    CHECK (status IN ('pending_generation','generated','signed','finalized','skipped')),
  unsigned_pdf_path     TEXT,                       -- supabase storage path
  signed_pdf_path       TEXT,                       -- after all required signatures
  field_data_snapshot   JSONB,                      -- exact data stamped (audit)
  source_pdf_hash       TEXT,                       -- SHA-256 of the source PDF at stamp time
  field_map_version     TEXT,                       -- version key from the field-map JSON
  generated_at          TIMESTAMPTZ,
  finalized_at          TIMESTAMPTZ,
  required_signer_member_ids UUID[] NOT NULL DEFAULT '{}',   -- household_member.id values
  collected_signer_member_ids UUID[] NOT NULL DEFAULT '{}',  -- subset, populated as sigs arrive
  conditional_trigger   TEXT,                       -- which intake answer triggered this form (null if always-required)
  feature_flag_key      TEXT,                       -- maps to pbv_form_templates.generation_enabled
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (full_application_id, form_id, language)
);

CREATE INDEX idx_pbv_form_documents_app ON public.pbv_form_documents (full_application_id);
CREATE INDEX idx_pbv_form_documents_status ON public.pbv_form_documents (status);
```

### 4. New table — `pbv_signature_events`

One row per (signer × form × ceremony-tap). For the hybrid signing flow: tenant draws their signature once; each per-form tap-to-confirm creates one row here.

```sql
CREATE TABLE public.pbv_signature_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_document_id    UUID NOT NULL REFERENCES public.pbv_form_documents(id) ON DELETE CASCADE,
  signer_member_id    UUID NOT NULL REFERENCES public.pbv_household_members(id) ON DELETE CASCADE,
  signature_image_path TEXT NOT NULL,                -- storage path; same image reused across all of this signer's per-form taps
  typed_name          TEXT NOT NULL,                 -- identity confirmation captured at signing time
  signed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address          TEXT,
  user_agent          TEXT,
  device_owner        TEXT NOT NULL DEFAULT 'self'
    CHECK (device_owner IN ('self','hoh_device','staff_assisted')),
  document_hash       TEXT NOT NULL,                 -- SHA-256 of the form_document at moment of signing
  ceremony_id         UUID,                          -- groups events from the same physical signing ceremony
  consent_text_version TEXT NOT NULL,                -- version of the consent text the tenant saw before tapping
  CONSTRAINT one_event_per_signer_per_form UNIQUE (form_document_id, signer_member_id)
);

CREATE INDEX idx_pbv_signature_events_form ON public.pbv_signature_events (form_document_id);
CREATE INDEX idx_pbv_signature_events_signer ON public.pbv_signature_events (signer_member_id);
CREATE INDEX idx_pbv_signature_events_ceremony ON public.pbv_signature_events (ceremony_id);
```

**Note:** This table is form-execution-specific. The existing `signature_capture_audit` table from PRD-04 (post-approval signing) covers a separate concern (lease, HAP contract, etc.). Two tables avoids overloading either. Cross-reference if a tenant signs both flows.

### 5. New table — `pbv_summary_documents`

```sql
CREATE TABLE public.pbv_summary_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id UUID NOT NULL UNIQUE REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  language            TEXT NOT NULL,                -- 'en' | 'es' | 'pt'
  template_version    TEXT NOT NULL,                -- which version of the summary template
  pdf_storage_path    TEXT,
  signed_at           TIMESTAMPTZ,
  signature_event_id  UUID REFERENCES public.pbv_signature_events(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6. New table — `pbv_form_templates` (or extend existing)

If `pbv_full_app_document_templates` is the right place to add generation flags, extend it. Otherwise create a sibling table for form-execution-specific metadata:

```sql
CREATE TABLE public.pbv_form_templates (
  form_id             TEXT PRIMARY KEY,             -- e.g. 'briefing_docs_certification', 'vawa_certification'
  display_name_en     TEXT NOT NULL,
  display_name_es     TEXT NOT NULL,
  display_name_pt     TEXT,
  generation_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  source_pdf_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (source_pdf_status IN ('pending','sourced','verified')),
  per_person_scope    TEXT NOT NULL                 -- 'submission_level' | 'head_of_household_only' | 'each_adult' | 'each_member'
    CHECK (per_person_scope IN ('submission_level','head_of_household_only','each_adult','each_member','individual')),
  conditional_rule    TEXT,                         -- e.g. 'q8_dv_yes', 'q10_reasonable_accommodation_yes', null = always render
  category            TEXT,                         -- 'application','release','affidavit','declaration','obligations'
  notes               TEXT
);
```

Seed at migration time with all 17 forms. The 12 sourced + 1 mapped-pending (zero_income_statement) get `generation_enabled = TRUE`; the 4 truly source-pending get `generation_enabled = FALSE`. Toggleable per row.

**Decision point during build:** if extending `pbv_full_app_document_templates` is cleaner, do that and skip the new table. Document in build report. Either way, the gating flag is the contract.

### 7. API surface

All routes are tenant-token-scoped under `/api/t/[token]/pbv-full-app/`. They build on the existing route tree.

| Method + path | Purpose | New / Modify |
|---|---|---|
| `GET /api/t/[token]/pbv-full-app/` | Bootstrap — returns intake_status, signing_status, language settings, application metadata | Modify (existing route, extend payload) |
| `POST /api/t/[token]/pbv-full-app/intake/[section]` | Save section data into `intake_data` jsonb, set `intake_status` if first call | NEW |
| `POST /api/t/[token]/pbv-full-app/intake/complete` | Mark intake complete; triggers form generation | NEW |
| `POST /api/t/[token]/pbv-full-app/generate-forms` | Idempotent — produces stamped PDFs for all required forms based on intake_data and conditional rules | NEW |
| `GET /api/t/[token]/pbv-full-app/forms` | Lists generated forms with status, signed status per signer | NEW |
| `GET /api/t/[token]/pbv-full-app/forms/[form_document_id]/preview` | Signed URL for preview PDF | NEW |
| `POST /api/t/[token]/pbv-full-app/sign-summary` | Captures summary doc signature (must precede federal form signing) | NEW |
| `POST /api/t/[token]/pbv-full-app/sign-form` | Captures one form's per-form tap-to-confirm. Body: form_document_id, typed_name, ceremony_id, ip, user_agent, signature_image_ref. | NEW |
| `POST /api/t/[token]/pbv-full-app/signature/capture` | Captures the one signature image at ceremony start; returns signature_image_ref token to use in sign-form calls | NEW |
| `POST /api/t/[token]/pbv-full-app/finalize` | Existing — extend to also verify all required signatures captured | Modify |
| `POST /api/t/[token]/pbv-full-app/resume` | Re-send SMS magic link, rate-limited | NEW |
| `GET /api/t/[token]/pbv-full-app/additional-signers` | List of household members who still need to sign, with their personal magic_link_token if generated | NEW |
| `POST /api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link` | Generate + send magic_link_token for a non-HOH adult | NEW |

Identity verification standard (typed name + signature + IP + timestamp + device-owner) is built into `sign-form` and is non-negotiable per the decision log default. Add stronger verification later if HACH requires.

### 8. Idempotency

All POST endpoints under `/api/t/[token]/pbv-full-app/` accept an `Idempotency-Key` header per the convention established in PRD-19 (`lib/idempotency.ts` + `tenant_idempotency_keys` table). The intake/save and sign-form endpoints especially — flaky mobile networks must not double-write signature events.

### 9. Form generation pipeline

Server-side (the `generate-forms` endpoint):

1. Read `intake_data` + `pbv_household_members` rows.
2. Evaluate each row in `pbv_form_templates` where `generation_enabled = TRUE`:
   - If `conditional_rule` is null, generate.
   - If `conditional_rule` matches a truthy value in intake_data or a derived household state, generate.
   - Else, skip (row stays `pending_generation` and is not returned in the forms list).
3. For each form to generate:
   - Build `field_data` from intake_data + member roster per the field-map prefill rules (resolved server-side from `pbv-field-inventory.md` mapping — bake into `lib/pbv/form-generation/field-mapping.ts`).
   - Invoke a server-side wrapper around `scripts/stamp-form.mjs` logic (NOT shelling out — port the stamping logic to a TS module callable from API routes). Call it `lib/pbv/form-generation/stamper.ts`.
   - Compute SHA-256 of the source PDF, store in `source_pdf_hash`.
   - Save the unsigned stamped PDF to Supabase Storage at `pbv/{application_id}/forms/{form_id}-{language}-unsigned.pdf`.
   - Insert/update the `pbv_form_documents` row.
4. Return the list of generated forms.

This step is idempotent — calling `generate-forms` twice with the same intake_data produces the same PDFs (same source hash, same field data) and updates timestamps but doesn't proliferate rows.

### 10. Signature application pipeline

When `sign-form` is called for a (form_document, signer):

1. Validate the signer is in the form's `required_signer_member_ids`.
2. Validate the summary doc is signed (for federal forms only).
3. Load the signature image from storage.
4. Re-load the unsigned stamped PDF.
5. Stamp the signature image at the field-map's signature coordinate for this signer.
6. If this is the last required signer for this form: save as signed, set `status = signed`, store path in `signed_pdf_path`.
7. If not all signers complete: store the in-progress PDF (with N-of-M signatures) at `pbv/{application_id}/forms/{form_id}-{language}-progress.pdf`; finalize on the last sign.
8. Hash the document state the signer saw and store in `pbv_signature_events.document_hash`.
9. Insert the `pbv_signature_events` row.

### 11. Conditional rule evaluation

Encoded in `lib/pbv/conditional-rules.ts`. Two layers:

- **Per-form rules** — keyed off `pbv_form_templates.conditional_rule` (a string like `q8_dv_yes` or `section_iii_zero_income_any_adult`). Function returns boolean given intake_data + members.
- **Per-section rules** — for Section VI (medical) and Section VIII (household expenses) — used at intake render time AND at form generation to avoid mismatched state.

All rules live in one module so PRD-25's intake UI and PRD-24's form generation use the same predicates.

### 12. Trigger-upload pipeline reuses `application_documents`

The inventory's `trigger_upload` doc-type slugs (paystubs, ssi_award_letter, etc.) map to `application_documents.doc_type`. PRD-24 does NOT create a new uploads table. Two pieces of work:

1. Ensure `application_documents.doc_type` (or whatever the existing column is named) accepts the slugs in the inventory's "Doc-type slugs referenced in trigger_upload" section. If new slugs are needed, add them to the enum/seed as a migration.
2. When intake answers fire `trigger_upload` conditions, surface the required uploads in the Phase 1 review screen and in the existing tenant document UI. PRD-25 specifies UX; this PRD lays the data — confirm `application_documents` has a way to mark a doc as "required, not yet uploaded" linked to a specific intake trigger.

## Scope

### What this PRD does

- Migration adding columns to `pbv_full_applications` and `pbv_household_members`.
- Migrations creating `pbv_form_documents`, `pbv_signature_events`, `pbv_summary_documents`, and `pbv_form_templates`.
- Seed migration populating `pbv_form_templates` with all 17 form rows.
- Migration ensuring `application_documents.doc_type` accepts the inventory's slug set (add seed rows; do NOT change existing doc_type column type).
- TypeScript modules:
  - `lib/pbv/form-generation/stamper.ts` — server port of stamp-form.mjs
  - `lib/pbv/form-generation/field-mapping.ts` — intake_data → form field_data resolution
  - `lib/pbv/conditional-rules.ts` — predicate functions per form/section
- API routes per §7.
- Unit tests for: stamper, field-mapping, conditional-rules.
- Vitest schema-contract test that confirms the migrations apply cleanly.

### What this PRD does NOT do

- Does not implement intake UI (PRD-25).
- Does not implement review-and-sign UI (PRD-26).
- Does not implement additional-adults UI (PRD-27).
- Does not author summary doc content (PRD-28).
- Does not flip `generation_enabled` for source-pending forms — they stay off.
- Does not change `application_documents` table schema (only seed additions).
- Does not modify `signature_capture_audit` (PRD-04's table) — `pbv_signature_events` is parallel, scoped to form execution.

## Affected files

### Migrations
- `supabase/migrations/2026051X000000_pbv_form_execution_columns.sql` — ALTERs on `pbv_full_applications` and `pbv_household_members`
- `supabase/migrations/2026051X010000_pbv_form_documents.sql`
- `supabase/migrations/2026051X020000_pbv_signature_events.sql`
- `supabase/migrations/2026051X030000_pbv_summary_documents.sql`
- `supabase/migrations/2026051X040000_pbv_form_templates.sql` (with seed)
- `supabase/migrations/2026051X050000_pbv_form_execution_doc_type_seed.sql` (if needed for new slugs)

### New library
- `lib/pbv/form-generation/stamper.ts`
- `lib/pbv/form-generation/field-mapping.ts`
- `lib/pbv/form-generation/source-pdfs.ts` (loads source PDFs from `docs/templates/` at build time, embedded in deploy)
- `lib/pbv/conditional-rules.ts`
- `lib/pbv/form-templates.ts` (typed access to pbv_form_templates rows)

### New API routes
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- `app/api/t/[token]/pbv-full-app/forms/route.ts`
- `app/api/t/[token]/pbv-full-app/forms/[form_document_id]/preview/route.ts`
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts`
- `app/api/t/[token]/pbv-full-app/signature/capture/route.ts`
- `app/api/t/[token]/pbv-full-app/resume/route.ts`
- `app/api/t/[token]/pbv-full-app/additional-signers/route.ts`
- `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts`

### Modified API routes
- `app/api/t/[token]/pbv-full-app/route.ts` — extend GET payload with form-execution status
- `app/api/t/[token]/pbv-full-app/finalize/route.ts` — verify all signatures before allowing finalize

### Tests
- `lib/pbv/__tests__/stamper.test.ts`
- `lib/pbv/__tests__/field-mapping.test.ts`
- `lib/pbv/__tests__/conditional-rules.test.ts`
- `lib/pbv/__tests__/form-templates-seed.test.ts`
- `lib/__tests__/schema-contract.test.ts` — extend to cover new tables

## Phases

### Phase 1 — Migrations (one PR-step)
- Write all migrations in dependency order.
- Local apply, smoke-test on a fresh DB.
- Commit: `feat(pbv-form-execution): db schema for form documents, signatures, summary, templates`.

### Phase 2 — Library port
- Port `stamp-form.mjs` to `lib/pbv/form-generation/stamper.ts` (TS, importable, no shell).
- Build `field-mapping.ts` from the inventory's prefill_source column (commit a typed lookup table generated from the inventory).
- Build `conditional-rules.ts` with the per-form and per-section predicates.
- Unit tests for each module.
- Commit: `feat(pbv-form-execution): server-side stamping, field mapping, conditional rules`.

### Phase 3 — Intake API
- `intake/[section]` save endpoint with idempotency
- `intake/complete` endpoint
- Modify root GET to include form-execution status
- Commit: `feat(pbv-form-execution): intake save + complete API`.

### Phase 4 — Form generation API
- `generate-forms` endpoint
- `forms` list endpoint
- `forms/[id]/preview` endpoint
- Idempotency on generate-forms
- Commit: `feat(pbv-form-execution): form generation API`.

### Phase 5 — Signing API
- `signature/capture` endpoint
- `sign-summary` endpoint (must precede federal forms)
- `sign-form` endpoint with stamping pipeline
- Extend `finalize` to verify all signatures present
- Commit: `feat(pbv-form-execution): signing API with per-form events`.

### Phase 6 — Additional-signer API
- `additional-signers` GET
- `additional-signers/[member_id]/send-link` POST
- Resume token regeneration endpoint
- Commit: `feat(pbv-form-execution): additional-signer magic links + resume API`.

### Phase 7 — Tests + verification
- Cover stamper, field-mapping, rules, schema contract.
- Vitest passes.
- TypeScript compile passes.
- `npm run build` passes (full clean build, no `Select-Object` truncation).

### Phase 8 — Build report
Write `docs/build-reports/24-pbv-form-execution-data-model-and-api-build-report_2026-05-15.md`.

## Out of scope

- All UI (Phases 25–27)
- Real summary doc content (Phase 28)
- Staff-assisted mode (Phase 29)
- E2E tests against UI (Phase 30)
- Flipping `generation_enabled` to TRUE for source-pending forms

## Acceptance criteria

- All 6 migrations apply cleanly on a fresh DB and a current `dev` DB
- `pbv_form_templates` is seeded with 17 rows; 13 have `generation_enabled = TRUE`, 4 have `FALSE` (zero_income_statement defaults to TRUE if its source PDF landed in PRD-23, else FALSE)
- All API routes return correctly shaped responses on the happy path
- Idempotency-Key header dedupes intake saves and sign-form calls
- `lib/pbv/form-generation/stamper.ts` produces byte-identical output to `scripts/stamp-form.mjs` for the briefing-cert pilot data (regression contract)
- Unit tests pass; schema-contract test covers the new tables
- `npm run build` succeeds (PowerShell, no truncation)
- Build report committed

## Open questions

- Whether to extend `pbv_full_app_document_templates` instead of creating `pbv_form_templates` — decide during Phase 1 based on the existing table's columns.
- Whether `signature_capture_audit` should be extended to cover form-execution sigs instead of creating `pbv_signature_events` — preference is parallel tables (form-exec vs post-approval), but if the existing table's columns line up cleanly, extension is acceptable. Decide during Phase 1.
- Exact storage path scheme for stamped PDFs (suggestion above; confirm against the existing PBV storage convention).
- How long the `signature_image_ref` token from `signature/capture` should live before forcing re-capture (suggest: 60 minutes; flush to storage on first `sign-form` use).
