# PRD-23 — PBV Form Execution: Field Maps for Remaining Sourced Forms

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/22-pbv-form-execution-toolchain-and-hard-form-pilot_prd_2026-05-15.md`, `docs/fullApp-Plan/pbv-field-inventory.md`
**Depends on:** PRD-22 complete (toolchain + Citizenship Declaration pilot validated)

---

## Problem Statement

PRD-22 validated the stamping pipeline against the simplest form (briefing-cert) and the hardest structural case (Citizenship Declaration table). The remaining 10 sourced forms need field maps so PRD-25 / 26 have something to stamp. This is mechanical labor against the validated playbook.

Field maps for the 5 source-pending forms (VAWA, Reasonable Accommodation, healthcare-provider-release, childcare-expense-verification, zero_income_statement) are NOT in this PRD. They land in a follow-on PRD when source PDFs arrive.

## Evidence baseline (verified 2026-05-15)

- After PRD-22, the field-map directory contains 3 maps: `briefing-cert-en.json`, `briefing-cert-es.json`, `citizenship-declaration-en.json`, `citizenship-declaration-es.json`.
- `pbv-field-inventory.md` enumerates 13 forms total; PRD-22 completed 2 of them (× 2 languages = 4 maps).
- 10 forms remain × 2 languages = **20 field maps** to produce in this PRD.
- `zero_income_statement` is documented in the inventory but marked `[Unverified]` — its source PDF is on HACH's website but Alex has not yet retrieved it. Default for this PRD: skip zero_income_statement; if Alex has dropped the source PDF into `docs/templates/` by build time, include it as a 21st map.

## Forms in scope

| # | form_id | EN page in source packet | ES page | per_person_scope from inventory | Complexity |
|---|---|---|---|---|---|
| 1 | `main_application` | 1, 3, 5, 7, 9 | 2, 4, 6, 8, 10 | mixed | High — multi-page, mixed scope, conditional sections |
| 2 | `hud_9886a` | TBD (look in packet) | TBD | each_adult | Medium — standard HUD form |
| 3 | `hach_release` | TBD | TBD | each_adult | Medium |
| 4 | `child_support_affidavit` | TBD | TBD | submission_level | Low |
| 5 | `no_child_support_affidavit` | TBD | TBD | submission_level | Low |
| 6 | `obligations_of_family` | TBD | TBD | each_adult | High — multi-signer block per row |
| 7 | `eiv_guide_receipt` | TBD | TBD | each_adult | Low |
| 8 | `debts_owed_phas` | TBD | TBD | each_adult | Low |
| 9 | `hud_92006` | TBD | TBD | each_adult | Medium — supplemental verification form |
| 10 | `criminal_background_release` | TBD | TBD | each_adult | Low |

Phase 1 of the build is to read the source packet and fill in the TBD columns. Inventory may have notes that help.

## Key decisions

### 1. Field map structure is set by PRD-22 outcome

Use the field-map JSON shape that PRD-22 finalized (Pattern A or B for table-style forms). Don't invent new patterns. Document any deviation in the affected form's NOTES.

### 2. Inventory is the source of truth for field names

Every `field_name` in a field map must match the inventory's `field_name` column for that form. If you encounter a field on the PDF that isn't in the inventory, flag it in the form's NOTES and ask Alex — don't invent a name.

### 3. `prefill_source` is mapping intent, not a function

The inventory's `prefill_source` column tells you where the data will come from at runtime (e.g., `intake.income.employment`). The field map itself does NOT contain this mapping — the runtime API (PRD-24) does. The field map only contains: field name, type, coordinates, page, font size, language label. Don't pollute field maps with prefill logic.

### 4. Per-language extraction is mandatory

Even when ES coordinates look identical to EN, run the extraction and produce the ES file. Same rationale as PRD-22.

### 5. Form generation feature flag for 5 source-pending forms

The 5 source-pending forms have inventory entries (some `[Unverified]`) but no source PDFs. PRD-24 introduces a feature flag (`pbv_form_templates.generation_enabled` boolean or similar). This PRD does NOT touch the database — it only sets the expectation that those forms will land in field-map files at `scripts/field-maps/` once sourced, and PRD-24 will gate them off until each one's flag flips.

### 6. Output structure mirrors PRD-22

For each form × language:
- `scripts/field-maps/{form_id}-{language}.json`
- `scripts/field-maps/{form_id}-{language}.NOTES.md`
- `docs/templates/{form_id}-{language}.pdf` (extracted from source packet)
- `docs/templates/{form_id}-{language}-filled.pdf` (Maria household stamped output)
- `scripts/output/render/{form_id}-{language}-page{n}.png` (gitignored except for representative samples)

## Scope

### What this PRD does

- Extracts each remaining sourced form from the bilingual packet into its own PDF (EN + ES).
- Produces field maps for all 10 forms × 2 languages.
- Stamps each with the Maria household data and renders to PNG for verification.
- Documents per-form NOTES (extraction tooling, coordinate notes, deviations).
- Updates the shared `scripts/sample-data/maria-household.json` to include any data fields these 10 forms need that the household sample doesn't already cover.

### What this PRD does NOT do

- Does not touch any database, API, or UI.
- Does not handle the 5 source-pending forms (VAWA, RA, healthcare-provider-release, childcare-expense-verification, zero_income_statement).
- Does not modify the source packet.
- Does not write tests against the field maps.
- Does not change the field-map structure decided in PRD-22.

## Affected files

### New extracted source PDFs (in `docs/templates/`)
- `main-application-en.pdf` (5 pages: 1,3,5,7,9 of source)
- `main-application-es.pdf` (5 pages: 2,4,6,8,10)
- `hud-9886a-en.pdf`, `hud-9886a-es.pdf`
- `hach-release-en.pdf`, `hach-release-es.pdf`
- `child-support-affidavit-en.pdf`, `-es.pdf`
- `no-child-support-affidavit-en.pdf`, `-es.pdf`
- `obligations-of-family-en.pdf`, `-es.pdf`
- `eiv-guide-receipt-en.pdf`, `-es.pdf`
- `debts-owed-phas-en.pdf`, `-es.pdf`
- `hud-92006-en.pdf`, `-es.pdf`
- `criminal-background-release-en.pdf`, `-es.pdf`

### New field maps + NOTES (in `scripts/field-maps/`)
- 20 `.json` + 20 `.NOTES.md` files matching the above list × 2 languages

### Validation artifacts (in `docs/templates/`)
- 20 `{form_id}-{language}-filled.pdf` files (Maria household stamped)

### Updated
- `scripts/sample-data/maria-household.json` — extend as needed
- `scripts/stamp-form.mjs` — only if a form structure requires additive support; document any change in NOTES

## Phases

### Phase 1 — Packet survey

1. Open the bilingual source packet, identify the page range for each of the 10 forms (EN and ES).
2. Fill in the page-number column of the table above by editing this PRD (or in a separate `pbv-form-execution-packet-map.md` if you prefer).
3. Confirm against `pbv-field-inventory.md` form headers (which list page numbers).
4. Commit: `docs: packet page map for remaining sourced forms`.

### Phase 2 — Easy forms first (Low complexity)

Order matters. Do the 4 low-complexity forms first to build velocity and reveal any tooling issues before the high-complexity work:
- `child_support_affidavit`
- `no_child_support_affidavit`
- `eiv_guide_receipt`
- `debts_owed_phas`
- `criminal_background_release`

For each:
1. Extract the page(s) to `docs/templates/{form_id}-{language}.pdf` (EN + ES).
2. pdfminer extract coordinates.
3. Write field map per inventory `field_name` list.
4. Stamp with Maria household, render PNG, visual check.
5. Document in `{form_id}-{language}.NOTES.md`.

Commit: `field-maps: low-complexity sourced forms (5 forms × 2 langs)`.

### Phase 3 — Medium forms

- `hud_9886a`
- `hach_release`
- `hud_92006`

Same workflow.

Commit: `field-maps: medium-complexity sourced forms (3 forms × 2 langs)`.

### Phase 4 — High complexity

- `obligations_of_family` — multi-signer block per adult; use the table pattern from PRD-22 Citizenship Declaration.
- `main_application` — multi-page, mixed-scope. This is the largest single piece of work. Section by section:
  - Section I (HOH info + household roster)
  - Section II (income)
  - Section III (zero income declarations)
  - Section IV (assets)
  - Section V (childcare/disability)
  - Section VI (medical — conditional render at runtime, but field map covers it)
  - Section VII (criminal history rows)
  - Section VIII (household expenses — conditional render)
  - Section IX (DV / homeless / RA status)
  - Signature blocks

Commit (`obligations_of_family`): `field-maps: obligations-of-family (table-pattern multi-signer)`
Commit (`main_application`): `field-maps: main-application (multi-page sectioned)`

### Phase 5 — Optional zero_income_statement

Only if Alex has dropped `docs/templates/zero-income-statement-en.pdf` and `-es.pdf` by build time:
1. Confirm the inventory's `[Unverified]` field set against the actual PDF.
2. Produce field map.
3. Update inventory NOTES on this form to remove `[Unverified]` qualifier if confirmed.

If source PDF not present: skip this phase. Commit message in Phase 4 should note "zero_income_statement deferred — source PDF not present".

### Phase 6 — Build report

Write `docs/build-reports/23-pbv-form-execution-field-maps-build-report_2026-05-15.md`:
- Counts: forms mapped, PNGs rendered
- Per-form anomalies (coordinate drift between EN/ES, missing fields, extra fields not in inventory)
- Time spent
- Open questions for Alex
- Confirmation that no source modifications occurred
- Recommendations for PRD-24 (any schema implications from what was discovered)

## Out of scope

- Database / API / UI
- The 5 source-pending forms
- Field-map structural changes (use PRD-22's pattern)
- Form generation runtime logic (PRD-24)

## Acceptance criteria

- 20 field maps committed and valid JSON
- 20 NOTES.md files committed
- 20 stamped PDFs committed
- Representative PNG samples committed per form (one per language minimum; gitignore the rest)
- Maria household sample data covers every field referenced by these maps
- `scripts/stamp-form.mjs` either unchanged or additively extended (existing pilot field maps still work)
- Build report committed
- No modifications to source packet

## Open questions

- Are all 10 forms in the bilingual packet? Inventory says yes for 12 forms; PRD-22 covered 2; Phase 1 of this build confirms the remaining 10.
- Does `obligations_of_family` per-adult signer block have the same structural pattern as Citizenship Declaration? Probably yes; confirm during Phase 4.
- Does the main_application Race row checkbox group already have its `_other_text` field handled? Inventory lists it; field map should include it.
