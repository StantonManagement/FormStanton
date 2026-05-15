# PRD-23 Build Report: PBV Form Execution — Field Maps

**Date:** 2026-05-15
**PRD:** `docs/fullApp-Plan/23-pbv-form-execution-field-maps_prd_2026-05-15.md`
**Branch:** `dev`
**Status:** Complete (12 of 13 forms mapped; zero_income_statement skipped — no source PDF)

---

## Scope

Create machine-readable JSON field maps for all 12 sourced forms in the HACH PBV application packet, plus a coordinate extraction and visual verification workflow.

---

## Commits

| Commit | SHA | Description |
|--------|-----|-------------|
| 1 — Packet page map | `0e52d35` | Inventory of all 40 packet pages |
| 2 — Low complexity | `13d358f` | 5 forms × 2 langs (10 maps) |
| 3 — Medium complexity | `abde6a1` | hud_9886a, hach_release, hud_92006 EN+ES (6 maps) |
| 4 — High complexity | `7dc5f08` | obligations_of_family, citizenship_declaration EN+ES (4 maps) |
| 5 — Main application | `10c4cc1` | main-application EN+ES (2 maps, 5 pages each); stamp tool extended |

---

## Forms Mapped

| form_id | pages | langs | maps | row_pattern type |
|---------|-------|-------|------|-----------------|
| main_application | 5 | EN, ES | 2 | row_patterns (5 tables) |
| hud_9886a | 2 | EN, ES | 2 | row_pattern (signature grid) |
| hach_release | 1 | EN, ES | 2 | row_pattern (signature rows) |
| hud_92006 | 2 | EN, ES | 2 | flat fields only |
| obligations_of_family | 1 | EN, ES | 2 | flat fields only |
| citizenship_declaration | 1 | EN, ES | 2 | row_pattern (member table) |
| child_support_affidavit | 1 | EN, ES | 2 | flat fields only |
| no_child_support_affidavit | 1 | EN, ES | 2 | flat fields only |
| pet_addendum | 1 | EN, ES | 2 | flat fields only |
| vehicle_addendum | 1 | EN, ES | 2 | flat fields only |
| self_employment_worksheet | 1 | EN, ES | 2 | flat fields only |
| **zero_income_statement** | — | — | **0** | **SKIPPED — source PDF not present** |

**Total maps:** 22 (of target 24)

---

## Toolchain

All tools in `scripts/`:

| Tool | Purpose |
|------|---------|
| `stamp-form.mjs` | Stamps PDFs with text, images, checkboxes from JSON data |
| `render-stamped.py` | Renders stamped PDFs to PNG at configurable DPI (pymupdf) |
| `scripts/field-maps/*.json` | Field map definitions |
| `scripts/sample-data/*.json` | Sample data for verification stamps |
| `scripts/output/extract/*-text.txt` | Coordinate extractions (pdfminer) |
| `scripts/output/render/*-filled-page*.png` | Render outputs (local only, not committed) |
| `docs/templates/renders/` | Representative renders committed for record |

### stamp-form.mjs Extensions (this build)
- Added `row_patterns` (plural array) support — allows multiple independent repeating-row tables per form (needed by main_application)
- Column key `field_prefix` added as alias for `member_key` in row_patterns handler

---

## Coordinate Methodology

1. Extract page(s) from bilingual source PDF via `pymupdf`
2. Run pdfminer `extract_pages` over extracted PDF → UTF-8 text dump with `(page, y, x, text)` tuples
3. Match label text to inventory field names → derive x/y for fill position
4. For repeating tables: set `row_start_y` from header row, estimate `row_pitch` from visual row height
5. Stamp with sample data → render to PNG → visual verify

---

## Verification Status

All 22 maps stamped and rendered. Visual checks confirm:

- **Header fields** (name, address, phones): all land correctly on p1 of main_application
- **Repeating table rows** (adults, minors, income, assets): correct row-pitch descent confirmed
- **Signature blocks**: HOH and additional adult sigs land correctly on final pages
- **Citizenship table**: member names, DOBs, status checkmarks, and sigs all in correct columns
- **Obligations of family**: 5 fields in bottom fill section all correct

### Known Limitations
- **Checkbox fields** are defined in the inventory but not stamped (stamp tool renders `X` for checked, but all Yes/No checkbox pairs, race, ethnicity, marital status, income yes/no columns are excluded from sample data)
- **Income/asset/expense table row-start coordinates** for main_application are best-estimate from pdfminer text positions — will require real-application fine-tuning when rendering with live data
- **Section VIII (Household Expenses)** excluded from main_application field map (conditional on zero income; not in scope for field map verification)

---

## Files Committed

```
scripts/field-maps/         22 JSON field maps + 22 NOTES.md files
scripts/sample-data/        22 sample data JSON files
docs/templates/             22 extracted source PDFs + 22 filled PDFs
docs/templates/renders/     Representative PNG renders (p1 and key pages per form)
scripts/stamp-form.mjs      Extended with row_patterns array support
```

---

## Next Step

**PRD-24:** PBV Form Execution — Data Model and API
Define the Supabase schema for `pbv_submissions`, `pbv_form_completions`, and the fill API that maps intake data to field map keys and produces stamped PDFs on demand.
