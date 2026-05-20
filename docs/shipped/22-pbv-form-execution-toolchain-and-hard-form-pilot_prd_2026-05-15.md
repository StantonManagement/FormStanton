# PRD-22 — PBV Form Execution: Toolchain Hardening + ES Briefing-Cert + Citizenship Declaration Pilot

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md`, `docs/fullApp-Plan/pdf-overlay-build-handoff_2026-05-14.md`, `docs/fullApp-Plan/pbv-field-inventory.md`
**Supersedes:** Packets A+B+C from `pdf-overlay-build-handoff_2026-05-14.md`

---

## Problem Statement

The PDF overlay pilot (commits `887b656` → `c4ffac0`) proved the architecture works against the simplest form in the packet (Family Certification of Briefing Documents Received, English). Three gaps remain before scaling to all 17 forms:

1. **Visual verification is manual.** Analytical verification (pdfminer re-extraction confirming math) is not the same as visual verification (text sits on the actual underline). The pilot used Alex's eyes for final check. For 26+ field maps, that's a bottleneck and an error vector.
2. **Bilingual coordinate-mapping unproven.** The pilot stamped the English briefing-cert. We have not validated that a Spanish source PDF needs its own field map or can share with English. If ES has identical layout, we save labor; if not, we need to know now.
3. **The hard structural case is unpiloted.** Briefing-cert has 3 fields on a single page. Citizenship Declaration (pages 19–20 of the source packet) has a table with per-row signature columns — fundamentally different from briefing-cert structure. If this works, the remaining 12 sourced forms are mechanical labor.

This PRD closes all three.

## Evidence baseline (verified 2026-05-15)

- `scripts/stamp-form.mjs` exists and is validated by the pilot.
- `scripts/extract_text.py` exists (pdfminer wrapper).
- `scripts/field-maps/briefing-cert-en.json` exists and is the reference field map.
- `scripts/field-maps/briefing-cert-en.NOTES.md` documents the pdfminer playbook.
- `docs/templates/briefing-cert-en-filled.pdf` is the validated pilot output.
- `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` is the source packet (40 pages, EN/ES alternating).
- Python environment has `pdfminer.six` installed; does NOT have `pymupdf`.
- Pilot has not stamped any ES form.
- Pilot has not stamped any table-style form.

## Key decisions

### 1. pymupdf is the visual verification tool

- Install via `pip install pymupdf --break-system-packages` (Windows/PowerShell project conventions per the standing rules).
- pymupdf renders any PDF page to PNG at configurable DPI. Output PNG goes to `scripts/output/render/{form_id}-{language}-page{n}.png` for visual inspection.
- Render script is the source of truth for what the output looks like. Anyone reviewing a stamped form opens the PNG, not the PDF.

### 2. Field maps are per-language

- ES briefing-cert gets its own JSON file at `scripts/field-maps/briefing-cert-es.json` even if coordinates happen to match EN.
- Rationale: source PDFs may have small layout drift (label wraps, signature line positions); a per-language file is cheaper to maintain than a conditional shared file. If they're identical, the duplication is small. If they drift, we need separate files anyway.

### 3. Citizenship Declaration is the pilot for table-style stamping

- Pages 19–20 of source packet (EN page 19, ES page 20).
- Structure: a table of up to 6 household members, each row has: name, DOB, status checkboxes (citizen / eligible non-citizen / chose not to declare), date, signature.
- Per-row signature column means we stamp N signatures (one per signing household member row) at different y-coordinates derived programmatically from row index.
- If this works, the remaining table-style forms (Obligations of Family multi-signer block, Adults/Minors roster on the main application) are mechanical.

### 4. Sample data uses Maria Garcia-Rodriguez household

- HOH: Maria Garcia-Rodriguez (citizen)
- Spouse: Carlos Garcia-Rodriguez (eligible non-citizen, immigration doc to be uploaded)
- Adult son: Diego Garcia-Rodriguez (citizen)
- Two minor children (no Citizenship Declaration rows; that form is adults-only per HACH practice — confirm if inventory says otherwise)
- Same household used in all future pilots and PRD-30 E2E.

### 5. No DB writes, no app code in this PRD

- This is pure script/tooling work. No migrations, no API routes, no UI. Pure validation of the stamping pipeline against harder cases.
- Output is field maps + scripts + verified PDFs/PNGs in `docs/templates/` and `scripts/`.

## Scope

### What this PRD does

- Installs pymupdf into the Python environment.
- Adds `scripts/render-stamped.mjs` (or `.py`) that renders any PDF to PNG per page.
- Extracts `docs/templates/briefing-cert-es.pdf` from the source packet (page 38).
- Produces `scripts/field-maps/briefing-cert-es.json` and `briefing-cert-es.NOTES.md`.
- Stamps a Spanish briefing cert for Maria Garcia-Rodriguez, renders it, saves both PDF and PNG.
- Extracts `docs/templates/citizenship-declaration-en.pdf` (page 19) and `citizenship-declaration-es.pdf` (page 20).
- Produces `scripts/field-maps/citizenship-declaration-en.json`, `-es.json`, and NOTES for each.
- Stamps both Citizenship Declarations with the Maria household, renders, saves.
- Updates the pilot NOTES.md to document the pymupdf addition.

### What this PRD does NOT do

- Does not touch `pbv_full_applications` or any table.
- Does not touch any `/app/pbv-full-app/*` route.
- Does not add the 4 source-pending forms (VAWA, RA, healthcare-provider-release, childcare-expense-verification). Those wait for source PDFs.
- Does not produce field maps for the remaining 10 sourced forms — that's PRD-23.
- Does not implement AcroForm fields. We stamp on flat PDFs.
- Does not handle the `zero_income_statement` PDF — its source is on HACH's website and structure is `[Unverified]` per the inventory; that's PRD-23 territory once Alex retrieves the PDF.
- Does not modify any source PDF. Source packet is read-only.

## Affected files

### Python environment
- `pymupdf` package installed via pip with `--break-system-packages`

### New scripts
- `scripts/render-stamped.mjs` OR `scripts/render-stamped.py` (Cascade picks; document choice in the script header)

### New extracted source PDFs (from `docs/templates/Full Application Package (5-28-2025 bilingual).pdf`)
- `docs/templates/briefing-cert-es.pdf` (page 38)
- `docs/templates/citizenship-declaration-en.pdf` (page 19)
- `docs/templates/citizenship-declaration-es.pdf` (page 20)

### New field maps
- `scripts/field-maps/briefing-cert-es.json`
- `scripts/field-maps/briefing-cert-es.NOTES.md`
- `scripts/field-maps/citizenship-declaration-en.json`
- `scripts/field-maps/citizenship-declaration-en.NOTES.md`
- `scripts/field-maps/citizenship-declaration-es.json`
- `scripts/field-maps/citizenship-declaration-es.NOTES.md`

### New sample data
- `scripts/sample-data/maria-household.json` — shared sample household used across all form pilots

### New stamped outputs (validation artifacts; keep in repo for review)
- `docs/templates/briefing-cert-es-filled.pdf`
- `docs/templates/citizenship-declaration-en-filled.pdf`
- `docs/templates/citizenship-declaration-es-filled.pdf`

### New rendered PNGs (visual verification artifacts; in `scripts/output/render/` — should be gitignored except in this initial pilot)
- `scripts/output/render/briefing-cert-en-page1.png` (re-render existing pilot output)
- `scripts/output/render/briefing-cert-es-page1.png`
- `scripts/output/render/citizenship-declaration-en-page1.png`
- `scripts/output/render/citizenship-declaration-es-page1.png`

### Updated docs
- `scripts/field-maps/briefing-cert-en.NOTES.md` — append "Visual verification: pymupdf via scripts/render-stamped.{mjs|py}"

## Phases

### Phase 1 — Toolchain (Packet A)

1. Install pymupdf: `pip install pymupdf --break-system-packages`.
2. Verify install: `python -c "import fitz; print(fitz.__version__)"`.
3. Write `scripts/render-stamped.{mjs|py}` with this contract:
   - Input: `--input <pdf_path>` (required), `--output-dir <dir>` (default `scripts/output/render/`), `--dpi <int>` (default 150).
   - Output: one PNG per page named `{input_basename}-page{n}.png`.
   - Exit non-zero with stderr message on any failure.
4. Re-render the existing pilot output `docs/templates/briefing-cert-en-filled.pdf` as a smoke test. Confirm Maria Garcia-Rodriguez and the cursive signature appear on the underline visually, not just analytically.
5. Update `scripts/field-maps/briefing-cert-en.NOTES.md` to reference the new tool.
6. Commit: `tooling: add pymupdf visual verification (render-stamped)`.

### Phase 2 — ES briefing cert (Packet B)

1. Use existing pdf-lib or pdf-extraction tooling to extract page 38 from the source packet to `docs/templates/briefing-cert-es.pdf`. (Cascade picks the tool; document in commit message.)
2. Run `scripts/extract_text.py` against the new ES file with the same coordinate-dump modification used in the EN pilot. Output goes to `scripts/output/extract/briefing-cert-es-text.txt`.
3. Compare ES label coordinates against EN. Document differences in `briefing-cert-es.NOTES.md`:
   - If coordinates are byte-identical to EN, note that and reuse EN's field y-offsets.
   - If they drift (likely on label wraps), derive ES y-offsets from ES extraction.
4. Write `scripts/field-maps/briefing-cert-es.json` mirroring the EN structure but with ES coordinates and the Spanish field labels.
5. Stamp the ES briefing cert with Maria Garcia-Rodriguez data via `scripts/stamp-form.mjs`:
   - `--field-map scripts/field-maps/briefing-cert-es.json`
   - `--data scripts/sample-data/maria-household.json`
   - `--output docs/templates/briefing-cert-es-filled.pdf`
6. Render to PNG via `scripts/render-stamped`.
7. Visual sanity-check by Cascade: text sits on the underline; signature image is within signature line; date is on the date line.
8. Commit: `field-map: briefing-cert-es (Spanish version of pilot form)`.

### Phase 3 — Citizenship Declaration hard-form pilot (Packet C)

1. Extract pages 19 (EN) and 20 (ES) from source packet to `docs/templates/citizenship-declaration-{en,es}.pdf`.
2. Run pdfminer extraction. Document the table structure in NOTES:
   - Row 1 of the table starts at `y = ?` (to be measured).
   - Row spacing is `?` points per row (to be measured).
   - For each column (name, DOB, citizen-checkbox, eligible-checkbox, declined-checkbox, date, signature), record column x-position.
3. Write the field map to express the table programmatically. Two acceptable patterns:
   - **Pattern A — Explicit per-row fields:** `member_1_name`, `member_2_name`, ..., `member_6_name`. Verbose but straightforward.
   - **Pattern B — Templated rows:** field map has `row_pattern` block describing column x-positions + a `row_start_y` and `row_pitch`. Stamp script iterates members and computes y per row.
   - **Cascade picks one.** Pattern B is more extensible if other table-style forms follow. Pattern A is simpler for the pilot. Document the choice in NOTES with a one-line rationale.
4. Update `scripts/stamp-form.mjs` if needed to support whichever pattern is picked. Keep the change additive — existing field maps must still work.
5. Sample data for this form: only the 3 adults in the Maria household (HOH + spouse + adult son). The 2 minors are not in the Citizenship Declaration table per HACH practice (confirm against `pbv-field-inventory.md` § citizenship_declaration `per_person_scope` notes).
6. Stamp EN. Render. Visual check.
7. Stamp ES. Render. Visual check.
8. Commit: `pilot: citizenship-declaration table-style stamping (en + es)`.

### Phase 4 — Verification

For each of the 3 newly stamped forms (briefing-cert-es, citizenship-declaration-en, citizenship-declaration-es):

1. Open the PNG. Confirm visually:
   - Tenant data is on the correct line/cell.
   - Signature images are within the signature box, not above/below.
   - Source content (headers, body text, footers, OMB numbers) is unchanged from the source PDF.
2. Re-run pdfminer extraction on the filled PDF. Confirm stamped text appears at expected coordinates.
3. Diff the source PDF and the filled PDF using pdf-lib byte comparison — only the content stream for stamped pages should differ.
4. Document the verification result in the form's NOTES.md under a "Verification" section.

### Phase 5 — Build report

Write `docs/build-reports/22-pbv-form-execution-toolchain-pilot-build-report_2026-05-15.md` covering:
- What was built (toolchain, field maps, stamped outputs)
- Anything that deviated from this PRD and why
- The pattern picked for Citizenship Declaration (A or B) with rationale
- Visual verification observations (anything that needed iteration)
- Time spent per phase
- Open questions for Alex

## Out of scope (explicit)

- All 13 remaining field maps (PRD-23).
- Any database schema (PRD-24).
- Any tenant-facing UI (PRDs 25–27).
- Any signing flow logic (PRD-26).
- Any conditional gating logic at runtime (PRD-24 + PRD-25).
- Source-pending forms (VAWA, RA, healthcare-provider-release, childcare-expense-verification, zero_income_statement) — these wait for source PDFs and a separate sub-PRD.
- Modifying the source packet PDF.

## Acceptance criteria

- `pip install pymupdf` succeeded; `python -c "import fitz"` works.
- `scripts/render-stamped.{mjs|py}` is in the repo and produces PNGs.
- All four PNG files (briefing-cert-en re-render, briefing-cert-es, citizenship-declaration-en, citizenship-declaration-es) exist and look correct on visual inspection.
- `scripts/field-maps/briefing-cert-es.json`, `citizenship-declaration-en.json`, `citizenship-declaration-es.json` all valid JSON and consumable by `stamp-form.mjs`.
- `scripts/sample-data/maria-household.json` is the canonical sample household and is used by all subsequent PRD pilots.
- Build report committed.
- All commits are atomic per phase (3 commits expected: toolchain, briefing-cert-es, citizenship-declaration).

## Open questions

- Does the Citizenship Declaration list adults-only or include minors? Inventory § citizenship_declaration should answer; cross-check before pilot.
- Pattern A vs Pattern B for table-style field maps — Cascade picks during Phase 3.
- Whether `scripts/output/render/` should be gitignored. Default: gitignore everything except the 4 pilot reference PNGs (commit those for review history).
