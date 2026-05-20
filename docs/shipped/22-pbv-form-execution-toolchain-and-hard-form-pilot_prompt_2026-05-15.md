# Cursor/Windsurf Prompt — PRD-22: Toolchain + ES Briefing-Cert + Citizenship Declaration Pilot

## Context

The PDF overlay pilot proved the architecture works against the simplest form in the packet. Before scaling to all 17 forms, three gaps need to close: visual verification is manual (not programmatic), bilingual coordinate-mapping is unproven, and the hard structural case (table-style forms with per-row signatures) is unpiloted. This pass closes all three.

This is **pure script/tooling work**. No app code. No database. No UI. The output is field maps, scripts, stamped PDFs, and rendered PNGs.

## Required reading before you start

1. `docs/fullApp-Plan/22-pbv-form-execution-toolchain-and-hard-form-pilot_prd_2026-05-15.md` — full spec
2. `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md` — overarching architecture (the PRD-22 work feeds into this)
3. `docs/fullApp-Plan/pdf-overlay-validated_2026-05-14.md` — pilot playbook and why this architecture
4. `docs/fullApp-Plan/pbv-field-inventory.md` — § briefing_docs_certification and § citizenship_declaration sections specifically
5. `scripts/field-maps/briefing-cert-en.NOTES.md` — pdfminer playbook reference
6. `scripts/field-maps/briefing-cert-en.json` — reference field map
7. `scripts/stamp-form.mjs` — current stamper implementation

Skim — don't deep-read — the pilot output `docs/templates/briefing-cert-en-filled.pdf` to see what "correct" looks like.

## Closed decisions (do not relitigate)

- Architecture is PDF overlay via pdf-lib. Stamping mechanism is decided.
- Source packet is `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` and is read-only.
- ES gets its own field map file regardless of whether coordinates match EN.
- The Maria Garcia-Rodriguez household is the canonical sample data across all form pilots.
- pymupdf is the visual verification tool (not Imagemagick, not pdftocairo, not browser screenshots).
- Citizenship Declaration is the hard-form pilot. Obligations of Family is NOT in this PRD; that's PRD-23.
- The 5 source-pending forms (VAWA, RA, healthcare-provider-release, childcare-expense-verification, zero_income_statement) are NOT in this PRD.

## Decisions still open — pick during the build, document in NOTES

- **Field map pattern for tables** (Pattern A explicit-per-row vs Pattern B templated-rows). PRD-22 §Phase 3 lays out both. Pick one for Citizenship Declaration, justify in `citizenship-declaration-en.NOTES.md` in one paragraph.
- **Render script language** (Node `.mjs` calling pymupdf via subprocess, vs Python `.py` directly). PRD allows either. If Node, you'll spawn `python` from Node; if Python, it's pure pymupdf. Python is simpler. Document the choice in the script header.
- **Does Citizenship Declaration include minors?** Cross-check `pbv-field-inventory.md` § citizenship_declaration `per_person_scope`. If `each_adult`, exclude minors from the sample data. If `each_member`, include them. Document the answer in the form NOTES.
- **scripts/output/render/ gitignore policy.** Default per PRD-22: gitignore everything except the 4 pilot reference PNGs. If you have a better proposal, document and apply.

## Build this pass

### Commit 1 — Toolchain (pymupdf + render-stamped)

- `pip install pymupdf --break-system-packages`. Confirm with `python -c "import fitz; print(fitz.__version__)"`.
- Write `scripts/render-stamped.{mjs|py}`:
  - CLI args: `--input <pdf>`, `--output-dir <dir>` (default `scripts/output/render/`), `--dpi <int>` (default 150).
  - Output: one PNG per page, named `{input_basename}-page{n}.png`.
  - Non-zero exit on failure with stderr message.
- Re-render `docs/templates/briefing-cert-en-filled.pdf` as smoke test. Visual check: name on the name underline, signature within signature box, date on date line.
- Append a "Visual verification" subsection to `scripts/field-maps/briefing-cert-en.NOTES.md`.
- Add `scripts/output/render/` to `.gitignore` (or applicable section).
- Commit message: `tooling: add pymupdf visual verification (render-stamped)`.

### Commit 2 — briefing-cert-es

- Create `scripts/sample-data/maria-household.json` containing the canonical sample household (HOH Maria Garcia-Rodriguez, spouse Carlos, adult son Diego, two minor children). Fields should cover everything the briefing-cert and Citizenship Declaration need plus enough common fields (address, phone, DOBs) that later PRDs can reuse it.
- Extract page 38 from the source packet to `docs/templates/briefing-cert-es.pdf`. Use whatever extraction tool you've got (`pdftk`, `qpdf`, `pdf-lib`, `pymupdf`). Document the tool used in the commit message.
- Run `scripts/extract_text.py` (with coordinate-dump mode) against the ES file. Save extracted text + coords to `scripts/output/extract/briefing-cert-es-text.txt` (gitignored).
- Compare ES coordinates to EN. Write `scripts/field-maps/briefing-cert-es.NOTES.md` documenting:
  - Coordinate differences (or confirmation of byte-identical layout).
  - Spanish label text for each field, mapped to the same `field_name` keys as EN.
- Write `scripts/field-maps/briefing-cert-es.json` with the ES field map.
- Stamp ES briefing cert with Maria household data → `docs/templates/briefing-cert-es-filled.pdf`.
- Render to PNG. Save the PNG into the repo (override gitignore for pilot reference PNGs).
- Visual check by you: text on underline, signature in signature box, date on date line.
- Commit message: `field-map: briefing-cert-es (Spanish version of pilot form)`.

### Commit 3 — Citizenship Declaration (en + es)

- Extract pages 19 (EN) and 20 (ES) from source packet:
  - `docs/templates/citizenship-declaration-en.pdf`
  - `docs/templates/citizenship-declaration-es.pdf`
- Run extraction on both. Measure table row coordinates: row 1 y-start, row pitch (vertical spacing), column x-positions for name / DOB / status-checkboxes / date / signature.
- Pick field map pattern (A or B per PRD §Phase 3) and document choice in NOTES.
- If Pattern B (templated rows), extend `scripts/stamp-form.mjs` additively to support a `row_pattern` block. Existing field maps must still work without modification.
- Write `scripts/field-maps/citizenship-declaration-en.json`, `-es.json`, and NOTES for each.
- Extend `scripts/sample-data/maria-household.json` if needed to include the citizenship status fields for the 3 adults.
- Stamp EN with Maria household → `docs/templates/citizenship-declaration-en-filled.pdf`. Render to PNG. Visual check.
- Stamp ES → `docs/templates/citizenship-declaration-es-filled.pdf`. Render to PNG. Visual check.
- Commit message: `pilot: citizenship-declaration table-style stamping (en + es)`.

## Verification

After each commit, before moving to the next:

1. **Smoke test:** the render script runs without errors against the latest output.
2. **Visual sanity:** open the PNG and confirm — tenant data on the correct lines, signatures in signature boxes, source content unchanged.
3. **Analytical sanity:** re-run pdfminer extraction on the filled PDF and confirm stamped text appears at expected coordinates relative to labels.

At the end of all three commits, before writing the build report:

4. **Final acceptance:** all 4 PNGs (briefing-cert-en re-render, briefing-cert-es, citizenship-declaration-en, citizenship-declaration-es) exist and look right.
5. **No source modification:** `git status` should show source packet PDFs untouched.

## Anti-patterns — do NOT

- Do not modify `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` ever. Always extract to a new file.
- Do not modify the existing `briefing-cert-en.json` field map.
- Do not regenerate `briefing-cert-en-filled.pdf`. It's a pilot artifact for history; only re-render its PNG.
- Do not introduce new npm dependencies beyond what's in `package.json`. Only Python adds pymupdf.
- Do not produce field maps for any form outside this PRD (no Obligations of Family, no main_application, no HUD-9886A — those are PRD-23).
- Do not touch app code, route files, database migrations, or anything under `app/`, `lib/`, or `supabase/`.
- Do not write tests yet. Visual + analytical verification is sufficient at this stage. Test infrastructure lands in PRD-24.
- Do not commit `scripts/output/extract/` artifacts. Gitignore them.
- Do not over-engineer the render script. Single-purpose CLI, ~50 lines, no config files.

## Build report (you write this)

After verification passes, write `docs/build-reports/22-pbv-form-execution-toolchain-pilot-build-report_2026-05-15.md` with these sections:

1. **What shipped** — files added/modified per commit
2. **Deviations from PRD-22** — any decisions you made that the PRD didn't anticipate, with rationale
3. **Decisions resolved during build** — table pattern (A/B), render script language (Node/Python), citizenship-declaration scope (adults-only vs all-members)
4. **Visual verification findings** — anything that needed iteration; coordinate adjustments you made; surprises
5. **Time spent per commit** — rough estimate
6. **Open questions for Alex** — anything you'd want answered before PRD-23
7. **Recommendations for PRD-23** — which forms look easy/hard based on what you've seen

## When you're done

- All 3 commits on `feature/pbv-form-execution` branch
- Build report committed
- `pbv-field-inventory.md` not modified (it's the source of truth, not generated output)
- Run `git status` to confirm clean working tree
- Surface the build report path back to Alex and wait for sign-off before starting PRD-23
