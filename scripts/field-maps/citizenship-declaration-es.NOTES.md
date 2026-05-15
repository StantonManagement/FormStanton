# Field Map Notes: citizenship-declaration-es

## Source Extraction

Page 20 of `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` extracted using
pymupdf (`fitz.open` + `insert_pdf(from_page=19, to_page=19)`) → `docs/templates/citizenship-declaration-es.pdf`.

## PDF Coordinate Space

- Page: 612pt × **792pt** — 2pt taller than EN (790pt). ES source uses standard letter height.
- Origin: bottom-left (0,0), y increases upward

## Coordinate Comparison: ES vs EN

| Element                  | EN (pm_y) | ES (pm_y) | Δ      |
|--------------------------|-----------|-----------|--------|
| Row 1 bottom             | 347.3     | 352.8     | +5.5pt |
| Row pitch                | ~18.2pt   | ~18.2pt   | 0      |
| Status col 1 x           | 312       | 312.7     | +0.7   |
| Status col 2 x           | 330       | 330.8     | +0.8   |
| Status col 3 x           | 348       | 349.0     | +1.0   |
| Signature col x          | 361       | 361       | 0      |
| HOH sig label y          | 128.9     | 121.8     | -7.1pt |
| HOH date label y         | 129.0     | 121.9     | -7.1pt |
| HOH date label x         | 428.3     | 422.8     | -5.5pt |

The ES form has near-identical column positions (< 1pt drift on x). The row_start_y is 5.5pt
higher (ES text is slightly more compressed, placing the table higher on the page). The HOH cert
area is 7pt lower in the ES form. The 2pt extra page height is absorbed in the top margin.
Separate ES field map is required and correct — coordinates differ enough that the EN map would
misplace several fields.

## Table Structure

Column x-positions match EN (differences < 1pt, within font rendering tolerance). Row structure:
- `row_start_y = 352`, `row_pitch = 18.2`
- 9 rows available, 5 populated for Maria household

HOH Certification:
- "Firma de cabeza de familia" label at y=121.8, x=79.3
- "fecha" label at y=121.9, x=422.8
- Signature image: x=80, y=125, width=150, height=12
- Date text: x=462, y=133

## Field Map Pattern: Pattern B (Templated Rows)

Same pattern as EN — Pattern B templated rows. Rationale unchanged: 9-row regular table with
identical column structure. ES and EN patterns are structurally identical; only `row_start_y`
and HOH cert positions differ.

## Scope: All Members (Including Minors)

Same as EN: all 5 household members listed. HOH signs for minors in the signature column.

## Iteration History

| Iteration | Change | Result |
|-----------|--------|--------|
| 1 (final) | Derived from EN with adjusted row_start_y=352, hoh_sig y=125 | PASS — all rows correct, HOH cert signature inside box. |

ES form passed on first iteration. The structural similarity to EN after applying the coordinate
deltas made calibration straightforward.

## Verification

Visual verification via `scripts/render-stamped.py`:

```
python scripts/render-stamped.py --input docs/templates/citizenship-declaration-es-filled.pdf --output-dir scripts/output/render/ --dpi 150
```

Output: `scripts/output/render/citizenship-declaration-es-filled-page1.png`

Verified 2026-05-15: All 5 household members in correct rows. Names/DOBs in correct columns.
Checkboxes correct (Maria/Diego/Sofia/Lucas = col 1, Carlos = col 2). Signatures in signature
column. HOH cert date "2026-05-15" in fecha cell. Spanish source content (DECLARACIÓN DE
CIUDADANÍA title, instructions, status definitions 1/2/3, HACH letterhead in Spanish, footer)
unchanged. PASS on first iteration.

## Spanish Field Labels (mapped to EN field_name keys)

| field_name (shared key)     | ES label on form                            |
|-----------------------------|---------------------------------------------|
| full_name (member)          | Nombre del miembro de la familia            |
| dob (member)                | Fecha de Nacimiento                         |
| citizenship_status=citizen  | Estado 1 (ciudadano)                        |
| citizenship_status=eligible | Estado 2 (no ciudadano elegible)            |
| citizenship_status=no_decl  | Estado 3 (elige no declarar)                |
| signature (member)          | Firma                                       |
| hoh_certification_signature | Firma de cabeza de familia                  |
| hoh_certification_date      | fecha                                       |
