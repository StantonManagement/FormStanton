# PRD-55b Build Report: Form-Sourcing Corrections

**Date:** 2026-05-21
**Commit:** (filled at commit time)
**Branch:** feat/pbv-full-finalization

---

## Summary

PRD-55 classified forms by checking only `assets/pbv-source-pdfs/` and missed sources living in `docs/templates/`. PRD-55b corrects four classifications:

- `criminal_background_release` — re-enabled as generate-and-sign (was wrongly marked `upload`/`generation_enabled=FALSE`).
- `eiv_guide_receipt` — re-enabled (was wrongly left as `source-pending`).
- `insurance_settlement` + `cd_trust_bond` — disabled (were enabled and silently skipping; no source anywhere).

Net: every `generation_enabled=TRUE` template now resolves a source PDF + field map per required language. No template silently skips.

---

## Step 0 — DB Findings

Direct prod DB query was not run in-session (no DB tooling configured for this batch). State reasoned from PRD-55 build report + `OPEN-DECISIONS.md`:

| form_id | Pre-55b prod state (inferred) | PRD-55b target | Source of inference |
|---|---|---|---|
| criminal_background_release | `generation_enabled=FALSE`, `category='upload'` | `generation_enabled=TRUE`, `category='sign'`, `source_pdf_status='sourced'` | PRD-55 build report row 32; PRD-55 migration applied 2026-05-20 |
| eiv_guide_receipt | `generation_enabled=FALSE` (source-pending) | `generation_enabled=TRUE`, `source_pdf_status='sourced'` | PRD-55 build report row 36; not touched by PRD-55 migration |
| insurance_settlement | `generation_enabled=TRUE`, silently skipping | `generation_enabled=FALSE`, `source_pdf_status='pending'` | Absent from PRD-55 reconciliation; PRD-55b prompt confirms |
| cd_trust_bond | `generation_enabled=TRUE`, silently skipping | `generation_enabled=FALSE`, `source_pdf_status='pending'` | Absent from PRD-55 reconciliation; PRD-55b prompt confirms |

> **Cross-PRD flag for PRD-61 closeout pass:** The acceptance walk should query these four rows post-migration to confirm. If `insurance_settlement` / `cd_trust_bond` were actually `generation_enabled=FALSE` pre-batch, the migration is a harmless no-op; if they were `TRUE`, this is the corrective change.

---

## Files Changed

| File | Change |
|---|---|
| `assets/pbv-source-pdfs/criminal-background-release-en.pdf` | NEW (copied from `docs/templates/`) |
| `assets/pbv-source-pdfs/criminal-background-release-es.pdf` | NEW (copied from `docs/templates/`) |
| `assets/pbv-source-pdfs/eiv-guide-receipt-en.pdf` | NEW (copied from `docs/templates/`) |
| `assets/pbv-source-pdfs/eiv-guide-receipt-es.pdf` | NEW (copied from `docs/templates/`) |
| `lib/pbv/form-generation/source-pdfs.ts` | Added `criminal_background_release` + `eiv_guide_receipt` registry entries; updated header comment |
| `lib/pbv/form-generation/field-mapping.ts` | Added `resolveCriminalBackgroundRelease` + `resolveEivGuideReceipt`; switch-cases added |
| `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | Added both form_ids to `REQUIRED_FORM_IDS` |
| `supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql` | NEW corrective migration (commit + don't apply) |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | Logged PRD-55b decisions; listed new migration under "Prod migrations to apply" |
| `.gitattributes` | NEW — `* text=auto eol=lf` to stop CRLF churn going forward |

---

## Step-by-step verification

### Step 1 — criminal_background_release
- ✅ Copied `docs/templates/criminal-background-release-{en,es}.pdf` → `assets/pbv-source-pdfs/`.
- ✅ Added `SOURCE_PDFS['criminal_background_release']` (en+es).
- ✅ Added `resolveCriminalBackgroundRelease` resolver. Matches the field map field names (`first_name`, `middle_initial`, `last_name`, `dob`, `ssn`, `current_address_street`, `current_address_apt`, `current_address_city`, `current_address_state`, `current_address_zip`, `previous_address_*`, `signature_date`, `witness_signature_date`).
  - Address-split heuristic: `address_city_state_zip` is parsed with regex `/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i`. If parsing fails, all three fields remain blank (form printed with current street populated, city/state/zip blank for hand-fill — non-destructive degradation).
  - Previous address fields and signature image fields are blank by design (previous address not in intake; signature images stamped at signing ceremony).
- ✅ Migration sets `generation_enabled=TRUE`, `category='sign'`, `source_pdf_status='sourced'`.

### Step 2 — eiv_guide_receipt
- ✅ Copied `docs/templates/eiv-guide-receipt-{en,es}.pdf` → `assets/pbv-source-pdfs/`.
- ✅ Added `SOURCE_PDFS['eiv_guide_receipt']` (en+es).
- ✅ Added minimal `resolveEivGuideReceipt` — receipt is signature-only; resolver returns the standard `printed_name`/`signature_date` from `resolveSingleSignature`.
- ✅ Migration sets `generation_enabled=TRUE`, `source_pdf_status='sourced'`.

### Step 3 — insurance_settlement + cd_trust_bond
- ✅ Migration sets `generation_enabled=FALSE`, `source_pdf_status='pending'` for both. No source PDFs invented.
- ⚠ Logged as a soft BLOCKER under PRD-55b decisions in OPEN-DECISIONS — if these are real HACH forms, Alex needs to provide source PDFs (would be a separate PRD).

### Step 4 — Completeness guard
- ✅ `REQUIRED_FORM_IDS` now includes both new forms. Test green (7/7 passing, see static gate below).

---

## Static Gates

| Gate | Status | Notes |
|---|---|---|
| S1: completeness guard (`form-generation-completeness.test.ts`) | ✅ PASS | 7/7 tests pass with `criminal_background_release` + `eiv_guide_receipt` in the active set; SOURCE_PDFS entries resolve; field maps exist; resolvers don't throw. |
| S2: `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ PASS | Clean (no output = no errors). |
| S2: `npm run build` | ✅ PASS | Clean build, all pbv-full-app routes compile. |

---

## Deferred Runtime Gates (post-deploy + after migration applied)

| Gate | Description |
|---|---|
| **R1** | On a deploy with the PRD-55b migration applied: an application that requires `criminal_background_release` produces it in `generated[]` with stamped fields. Compare against `docs/templates/criminal-background-release-en-filled.pdf` as the expected visual; spot-check address-split heuristic on real `address_city_state_zip` strings. |
| **R2** | Same deploy: `eiv_guide_receipt` appears in `generated[]` (single-page receipt for ES; signature page only). |
| **R3** | Same deploy: `insurance_settlement` and `cd_trust_bond` do NOT appear in either `generated[]` or `skipped[]` (they're now `generation_enabled=FALSE`). |
| **R4** | Step 0 verification: post-migration, query `pbv_form_templates` for all four rows to confirm the actual pre-migration state matched the inferred state. |

---

## Decisions Logged to OPEN-DECISIONS.md

| PRD | Title | Type |
|---|---|---|
| PRD-55b | criminal_background_release re-enabled as generate-and-sign | DECISION |
| PRD-55b | eiv_guide_receipt re-enabled (O1 default) | DECISION |
| PRD-55b | insurance_settlement + cd_trust_bond disabled (O2 default → BLOCKER if real) | DECISION |
| PRD-55b | Migration `20260521000000_prd55b_form_sourcing_corrections.sql` | MIGRATION-TO-APPLY |

---

## Cross-PRD Flags (for PRD-61 closeout)

- PRD-61 fixtures: if any acceptance profile triggers `criminal_background_release`, its `expected_forms.generated[]` should include it. Add to Profile A or a new profile if Step 0 confirms it should fire for all adult applicants (per-person scope = `each_adult`).
- PRD-61 deferred gate consolidation: include R1–R4 above.

---

## Next Step

Proceed to **PRD-61** (final closeout, acceptance walk reflects 55b's corrected form set).
