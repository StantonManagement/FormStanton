# PRD-55b — Form-Sourcing Corrections (criminal_background_release, eiv, insurance/cd_trust)

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization` (same batch branch — see `BATCH-RUN-PROTOCOL.md`)
**Status:** Draft — ready for build
**Severity:** P1 — corrects two forms PRD-55 wrongly disabled, and closes two it missed.
**Depends on:** PRD-55 (this amends its template classifications). PRD-55's migration is **already applied to prod**, so this needs its own new migration.
**Blocks:** clean closeout (PRD-61) — the generated form set should be correct before the acceptance walk.

---

## Problem Statement

PRD-55 classified forms by checking only `assets/pbv-source-pdfs/` (where PRD-54 had copied 10 forms) and did not look in `docs/templates/`, where the original packet and per-form extracted PDFs actually live. As a result:

1. **`criminal_background_release` was wrongly disabled as "upload-only."** It is a generate-and-sign form: pages 39–40 of `docs/templates/Full Application Package (5-28-2025 bilingual).pdf`, and extracted PDFs already exist at `docs/templates/criminal-background-release-en.pdf` / `-es.pdf`. Its field map already exists (`scripts/field-maps/criminal-background-release-*.json`, per the PRD-55 build report). It was disabled by the already-applied PRD-55 migration.
2. **`eiv_guide_receipt` was left disabled as "source-pending"** for the same reason — its source PDFs exist (`docs/templates/eiv-guide-receipt-en.pdf` / `-es.pdf`) and a field map exists. It is a signed receipt in the packet (pp 25–28; ES pages blank → use EN for ES per the packet page map).
3. **`insurance_settlement` and `cd_trust_bond` were missed entirely** by PRD-55's reconciliation table. They were in the live `generate-forms` skip list (i.e. `generation_enabled=TRUE` and silently skipping) before the batch, and there is no evidence PRD-55 touched them — so they are likely still enabled and skipping, with no source PDFs anywhere (not in the packet, not in `docs/templates/`).

Net: two forms that should generate don't, and two unsourced forms may still be silently skipping — the exact failure mode PRD-55 set out to eliminate.

---

## Current state

| form_id | generation_enabled (prod, post-55 migration) | source PDF in `docs/templates/`? | field map? | resolver? | Correct target |
|---|---|---|---|---|---|
| criminal_background_release | FALSE (wrongly, as "upload") | ✓ en, es | ✓ | ✗ | **enable + sign** |
| eiv_guide_receipt | FALSE ("source-pending") | ✓ en (es blank → use en) | ✓ | ✗ | **enable** (confirm with Alex) |
| insurance_settlement | [Unverified — likely TRUE + skipping] | ✗ | ✗ | ✗ | **disable** (or source) |
| cd_trust_bond | [Unverified — likely TRUE + skipping] | ✗ | ✗ | ✗ | **disable** (or source) |

> Step 0 must confirm the live DB state of all four before changing anything — DB is canonical.

---

## Goals

1. `criminal_background_release` generates as a stamped, signable form, with its data correctly placed, for any application that requires it.
2. `eiv_guide_receipt` generates (default), unless Alex confirms it should not — log the decision either way.
3. `insurance_settlement` and `cd_trust_bond` no longer silently skip: each is either disabled (if unsourced/vestigial) or sourced — default disable, logged.
4. The PRD-55 completeness guard/test passes again with the corrected set (every `generation_enabled=TRUE` template resolves a source PDF + field map per required language).

## Non-goals

- pet/vehicle/self-employment stay deferred (Alex 2026-05-21 — genuinely unsourced; revisit when PDFs produced).
- No change to signing/finalize (PRD-56), documents UI (PRD-58), or summary content (PRD-59).
- No new federal form sourcing beyond copying the existing `docs/templates/` PDFs into `assets/`.

---

## Implementation phases

### Step 0 — Confirm live DB state
Query `pbv_form_templates` for `criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond`: `generation_enabled`, `source_pdf_status`, `category`, `conditional_rule`, `per_person_scope`. This is the canonical starting point.

### Step 1 — Re-enable criminal_background_release
- Copy `docs/templates/criminal-background-release-en.pdf` and `-es.pdf` → `assets/pbv-source-pdfs/` (matching the existing naming, e.g. `criminal-background-release-en.pdf`).
- Add a `SOURCE_PDFS['criminal_background_release']` entry in `lib/pbv/form-generation/source-pdfs.ts` (en + es).
- Add a `resolveCriminalBackgroundRelease` resolver in `lib/pbv/form-generation/field-mapping.ts` (mirror an existing single-signer form like `resolveHachRelease`; map against the existing field map). Confirm the field map field names match.
- Confirm `./assets/pbv-source-pdfs/**` tracing in `next.config.js` already covers the new files (it does — glob).
- Migration: set `generation_enabled=TRUE`, `category` back to its signed-form category (not `upload`) for `criminal_background_release`.

### Step 2 — Re-enable eiv_guide_receipt (default; log if Alex says no)
- Same pattern: copy `docs/templates/eiv-guide-receipt-en.pdf` (and `-es.pdf` if present; per packet map the ES guide is blank, so the en file may serve both — follow what PRD-23 did for eiv), add `SOURCE_PDFS` entry, add resolver, set `generation_enabled=TRUE`.
- If the eiv form is signature-only (no variable fields beyond name/date/signature), a minimal resolver is fine.
- Log the enable decision under the existing PRD-55 OPEN-DECISIONS eiv entry.

### Step 3 — Resolve insurance_settlement + cd_trust_bond
- If Step 0 shows them `generation_enabled=TRUE` with no source: set `generation_enabled=FALSE` in the migration (default — they have no source material anywhere and were never in the packet).
- If they turn out to be real, currently-needed forms, do NOT invent a source — log a BLOCKER in OPEN-DECISIONS noting they need source PDFs from HACH, and disable for now so they stop silently skipping.

### Step 4 — Re-run the completeness guard
- Run the PRD-55 completeness test/guard. It must pass: every `generation_enabled=TRUE` template resolves a source PDF + field map for each required language. Add `criminal_background_release` (+ eiv) to the test's expected-active set.

### Step 5 — Static gates + build report + migration
- `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; completeness test green.
- Build report at `docs/build-reports/55b-pbv-form-sourcing-corrections_build-report_2026-05-21.md`.
- New migration `supabase/migrations/<ts>_prd55b_form_sourcing_corrections.sql` — commit; **list in OPEN-DECISIONS "Prod migrations to apply."** (PRD-55's migration was applied to prod, so this one must be too, deliberately.)

---

## Verification / test plan

**Static (in-session):**
- **Gate S1:** completeness guard passes with `criminal_background_release` (+ eiv) in the active set; no `generation_enabled=TRUE` template resolves a null source PDF or field map.
- **Gate S2:** `tsc --noEmit` + `npm run build` clean.

**Deferred (post-deploy + after the new migration is applied):**
- **Gate R1:** on a deploy, an application that requires `criminal_background_release` produces it in `generated[]` with fields correctly stamped (compare against `docs/templates/criminal-background-release-en-filled.pdf` as the expected visual).
- **Gate R2:** `insurance_settlement` / `cd_trust_bond` no longer appear in `skipped[]` for a standard application (they're disabled).

---

## Open questions

- **O1:** Should `eiv_guide_receipt` generate (default yes), or is it handled some other way? Default taken: enable; log for confirmation.
- **O2:** Are `insurance_settlement` / `cd_trust_bond` real HACH forms that need sourcing, or vestigial template rows? Default: disable; log.

## Decisions

- **D1:** `criminal_background_release` is a generate-and-sign form (Alex 2026-05-21: "should be within the original PDF" — confirmed pp 39–40 + extracted PDFs exist). Reverses PRD-55's upload-only classification.
- **D2:** Unsourced forms are disabled, never left enabled-and-skipping. (Carries PRD-55 D3 forward.)

---

## Files expected to change

| File | Change |
|---|---|
| `assets/pbv-source-pdfs/criminal-background-release-{en,es}.pdf` | copied from `docs/templates/` |
| `assets/pbv-source-pdfs/eiv-guide-receipt-{en,es}.pdf` | copied from `docs/templates/` (es may reuse en) |
| `lib/pbv/form-generation/source-pdfs.ts` | add `criminal_background_release` + `eiv_guide_receipt` entries |
| `lib/pbv/form-generation/field-mapping.ts` | add resolvers for both |
| `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | add both to expected-active set |
| `supabase/migrations/<ts>_prd55b_form_sourcing_corrections.sql` | enable crim-bg + eiv; disable insurance_settlement + cd_trust_bond — commit, list in OPEN-DECISIONS, apply deliberately |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md`.
