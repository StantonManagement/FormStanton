# Build Prompt — PRD-86 Phase A (Field-Map Authoring & Preview Tool)

You are implementing **PRD-86, Phase A only**. Read it in full first:
`docs/fullApp-Plan/86-pbv-field-map-authoring-and-preview-component_prd_2026-05-31.md`

Follow `docs/SHELL-PROTOCOL.md`. Typecheck with `node ./node_modules/typescript/bin/tsc --noEmit` — never `npx tsc`.

## Goal of Phase A
A standalone tool that takes a source PDF (+ optional existing field map) and a sample dataset and emits a grayed-out spacing preview, a text-filled preview, and a validation report — then use it to correct the 11 PBV form field maps and regenerate the two affected applicants' unsigned documents.

## Scope guard
- New module: `lib/field-map-authoring/**`
- New dev harness script (under the repo's scripts dir)
- New fixtures under `tests/fixtures/field-map-authoring/**`
- Corrected PBV field-map config (same location/format the generator already loads — confirm via `lib/pbv/form-generation/source-pdfs.ts` and the generator before editing)
- Import `lib/pbv/form-generation/stamper.ts` READ-ONLY as the render engine. Do not modify it.
Do not touch the signing flow, intake, notifications, or `stamper.ts` itself.

## Build
1. **Ingest:** load a source PDF; record page count and each page media box. All placement validates against the media box. Coordinate space is pdf-lib's (origin bottom-left, y up) — match it everywhere.
2. **Proposal passes:** (1) detect fill anchors from the text layer + underscore/line/box detection → candidate regions; (2) map labels to data keys using `pbv-field-inventory.md` + `lib/pbv/form-generation/field-mapping.ts` conventions, font sizes assigned, unmapped → `fresh_input`; (3) fit width/font and detect repeating tables → emit `row_patterns`. Output a draft `FieldMap` in the exact `stamper.ts` shape (`FieldMap`/`FlatField`/`RowPattern`/`FieldMapColumn`).
3. **Preview A (grayed-out):** render the source PDF with a translucent rectangle at each field/row-cell box, no text. Tint overlaps and out-of-bounds boxes a warning color and list them.
4. **Preview B (text):** render via `stampForm()` with a sample dataset. This must be the same render path as production.
5. **Validators:**
   - Geometric: each rect within media box; no rect-rect overlap beyond a configurable point tolerance; `row_pattern` does not overflow (`row_start_y − row_pitch*max_rows ≥ page bottom`).
   - OCR round-trip: OCR Preview B; per field region compare extracted text to the stamped sample value; flag missing/truncated/misplaced with form_id, field name, page, box. Pick a server-side OCR lib (e.g. Tesseract) — confirm it's acceptable in this repo's deps; keep all bytes local, no external upload.
   - Emit `validation-report.json`.
6. **Harness:** `<script> <source.pdf> [existing-field-map.json] <sample-data.json>` → writes `preview-A.pdf`, `preview-B.pdf`, `validation-report.json` to an output dir.

## Apply to the current forms
7. Run all 11 `assets/pbv-source-pdfs/*` through the harness; correct each field map until Preview A spacing is clean and the OCR round-trip passes. Commit corrected maps.
8. Regenerate the unsigned documents for Mia (`2b451d4e-6578-43e6-9689-450cadcc62fe`) and Santha (`00d613e5-1573-4a7b-ab98-73a46ca4d681`) from the corrected maps. Do NOT notify them — that is PRD-85 Phase 4, operator-triggered.

## Gates (static only — no Playwright/e2e in the gate)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean
- Lint clean on touched files
- Unit tests: overlap detector flags overlapping rects; out-of-bounds detector flags a box past the media box; row-overflow detector flags an overflowing pattern; OCR round-trip flags a deliberately misplaced field and passes a correct one
- WYSIWYG check: one document rendered via the live generator and via the tool with identical data produces identical output (diff)
- Runtime/visual = manual review of the two preview PDFs (out of gate)

## Deliverables
- `lib/field-map-authoring/**`, the harness, fixtures, corrected PBV field maps, regenerated docs for the two applicants
- Build report at `docs/build-reports/86-pbv-field-map-authoring_build-report_2026-05-31.md`: what changed, OCR dependency chosen, per-form validation results, and confirmation the two applicants' docs were regenerated (and that notification was deliberately NOT sent).

## Do NOT do in Phase A
- No DB migrations, no admin route, no storage — that is Phase B.
- No auto-approval logic beyond reporting; the human approves by reviewing previews.
