# Cursor/Windsurf Prompt — PRD-23: Field Maps for Remaining Sourced Forms

## Context

PRD-22 validated the stamping pipeline. This pass produces field maps for the remaining 10 sourced forms × 2 languages = 20 field maps. Pure script/data work, no app code, no database.

This is mechanical labor against the playbook PRD-22 established. The PRD-22 build report tells you whether Pattern A or B was picked for table-style forms and any tooling adjustments — follow it.

## Required reading before you start

1. `docs/fullApp-Plan/23-pbv-form-execution-field-maps_prd_2026-05-15.md` — full spec
2. `docs/build-reports/22-pbv-form-execution-toolchain-pilot-build-report_2026-05-15.md` — what PRD-22 decided and any gotchas
3. `docs/fullApp-Plan/pbv-field-inventory.md` — the per-field source of truth for all 10 forms
4. The 4 existing field maps + their NOTES in `scripts/field-maps/` as reference
5. `scripts/stamp-form.mjs` — current capabilities
6. `scripts/sample-data/maria-household.json` — sample data shape

## Closed decisions (do not relitigate)

- Field-map structure was decided in PRD-22. Use the same pattern.
- Inventory `field_name` column is canonical — match exactly. If the PDF has a field the inventory doesn't, flag it; don't invent a name.
- Per-language field maps are required even when coordinates are identical.
- `scripts/stamp-form.mjs` extensions must be additive — existing maps must continue to work.
- Source packet PDF is read-only.
- The 5 source-pending forms are out of scope for this PRD.

## Decisions still open — pick during build, document in form NOTES

- **Page split of the multi-page main_application.** The form spans pages 1/3/5/7/9 in EN and 2/4/6/8/10 in ES. Decide: one extracted PDF per form (5 pages each) or per-section extracted PDFs (sections I–IX). Default: one PDF per form per language — pages 1+3+5+7+9 of source extracted into a single `main-application-en.pdf`. Document choice in `main-application-en.NOTES.md`.
- **Whether `zero_income_statement` lands in this PRD.** Only if `docs/templates/zero-income-statement-{en,es}.pdf` are present at build time. If not, skip.

## Build this pass

### Commit 1 — Packet page map

- Survey the bilingual source packet. Identify page numbers for each of the 10 forms (EN + ES).
- Update the form table in PRD-23 inline OR write a standalone `docs/fullApp-Plan/packet-page-map.md` documenting the page ranges.
- Commit: `docs: packet page map for remaining sourced forms`.

### Commit 2 — Low complexity (5 forms × 2 langs = 10 maps)

Forms in order:
1. `child_support_affidavit`
2. `no_child_support_affidavit`
3. `eiv_guide_receipt`
4. `debts_owed_phas`
5. `criminal_background_release`

For each form per language:
- Extract page(s) to `docs/templates/{form_id}-{language}.pdf`
- Extract coords via pdfminer
- Write `scripts/field-maps/{form_id}-{language}.json` + `.NOTES.md`
- Stamp with Maria household → `docs/templates/{form_id}-{language}-filled.pdf`
- Render PNG, visual sanity check

Extend `scripts/sample-data/maria-household.json` with any fields these forms need.

Commit: `field-maps: low-complexity sourced forms (5 × 2 langs)`.

### Commit 3 — Medium complexity (3 forms × 2 langs = 6 maps)

1. `hud_9886a`
2. `hach_release`
3. `hud_92006`

Same workflow. Some of these are per_person_scope: each_adult — sample data needs to cover all 3 adults in Maria's household; field map needs to handle multiple instances if the form has space for multiple signers (check the inventory).

Commit: `field-maps: medium-complexity sourced forms (3 × 2 langs)`.

### Commit 4 — Obligations of Family (1 form × 2 langs = 2 maps)

- Per the inventory, this is a multi-field signature block (name + date + phone + address + signature). Likely uses the same table pattern as Citizenship Declaration if the form has multiple signer rows; check the actual PDF.
- Extract, map, stamp for Maria + Carlos + Diego.
- Document in NOTES whether obligations-of-family table mirrors Citizenship Declaration or requires a different pattern.

Commit: `field-maps: obligations-of-family (multi-signer table)`.

### Commit 5 — Main application (1 form × 2 langs = 2 maps, multi-page)

This is the biggest single piece. Strategy:
- Extract all 5 pages per language into a single PDF per language.
- Map section by section. Cross-reference against inventory `## main_application` field list — the inventory groups fields by page, which makes it tractable.
- Sections I–IX field maps land in one JSON file per language but the NOTES.md should be organized by section.

Sample data for main_application will need to cover ~100 distinct fields. Most should already be in `maria-household.json` from prior commits; fill gaps.

Commit: `field-maps: main-application (multi-page sectioned)`.

### Commit 6 (optional) — zero_income_statement

Only if Alex has staged source PDFs. Per PRD-23 §Phase 5.

If staged: confirm `[Unverified]` field set against the actual PDF; map; stamp; render.

Commit: `field-maps: zero-income-statement (confirmed against source)`.

## Verification

After each commit:
- Render the stamped PNG and visually confirm correctness
- Run pdfminer extraction on the filled PDF; confirm stamped values land where expected
- `git status` shows clean working tree except expected new/modified files

After all commits:
- Field-map directory has 24 JSON files total (4 from PRD-22 + 20 from this PRD; 26 if zero_income_statement included)
- All maps validate as JSON
- All maps consume successfully by `scripts/stamp-form.mjs`
- Sample data covers all referenced fields with no `undefined` results during stamping
- No modifications to source packet PDF

## Anti-patterns — do NOT

- Do not produce maps for VAWA, Reasonable Accommodation, healthcare-provider-release, or childcare-expense-verification. Those have no source PDFs yet.
- Do not invent field names not in the inventory. Flag the discrepancy and ask.
- Do not skip the NOTES.md per form. The NOTES are the methodology audit trail; future engineers need them.
- Do not modify the field-map structure decided in PRD-22.
- Do not touch app code, routes, or database.
- Do not write end-to-end tests. Render+pdfminer is sufficient.
- Do not commit `scripts/output/extract/` artifacts. Gitignore them.
- Do not commit every rendered PNG. Commit one representative PNG per form per language; gitignore the rest.

## Build report (you write this)

Write `docs/build-reports/23-pbv-form-execution-field-maps-build-report_2026-05-15.md`:

1. **Forms shipped** — count and list per language
2. **Per-form notes** — anomalies, coordinate drift, missing/extra fields
3. **Sample data extensions** — what was added to `maria-household.json`
4. **Stamp-form.mjs changes** — if any (must be additive)
5. **zero_income_statement status** — included, skipped, or partially mapped
6. **Time per commit**
7. **Open questions for Alex**
8. **Recommendations for PRD-24** — anything you found that the data model needs to know about (e.g., a field referenced in 4 different forms that should canonicalize at the schema level)

## When you're done

- All commits on `feature/pbv-form-execution` branch
- Build report committed
- Inventory file not modified (it's the source of truth)
- 20 field maps + NOTES + stamped PDFs visible in `git status` clean
- Surface report path to Alex and wait for sign-off before PRD-24
