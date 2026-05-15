# Field Map Notes: citizenship-declaration-en

## Source Extraction

Page 19 of `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` extracted using
pymupdf (`fitz.open` + `insert_pdf(from_page=18, to_page=18)`) → `docs/templates/citizenship-declaration-en.pdf`.

## PDF Coordinate Space

- Page: 612pt × 790pt — same dimensions as briefing-cert-en
- Origin: bottom-left (0,0), y increases upward

## Scope Decision: All Household Members (Including Minors)

Per `pbv-field-inventory.md` § citizenship_declaration, `per_person_scope = individual` with
notes: "table repeats per household member; 9 rows shown." The form instructions state: "Complete
this declaration for all members of the household. Adults 18+ sign for themselves; adults
responsible for children 17 and younger must sign on their behalf."

**Decision: include all 5 members (3 adults + 2 minors).** The HOH signs for minors in the
signature column. This differs from PRD-22 § Key decisions note 4 which anticipated adults-only,
but the inventory and form instructions are unambiguous — all members are listed.

## Table Structure (measured from pymupdf drawings)

### Column x-positions (from vertical divider lines)

| Column            | x range    | Fill x |
|-------------------|-----------|--------|
| Family Member Name| 68..239   | 70     |
| Date of Birth     | 239..307  | 241    |
| Status 1 (citizen)| 307..325  | 312    |
| Status 2 (elig.)  | 325..343  | 330    |
| Status 3 (no decl)| 343..361  | 348    |
| Signature         | 361..542  | 364    |

### Row positions (pdfminer y — bottom of each row's bottom line)

| Row | pm_y (bottom) | fill text y | fill image y |
|-----|--------------|-------------|--------------|
| 1   | 347.3        | 352         | 349          |
| 2   | 328.1        | 333         | 330          |
| 3   | 309.9        | 315         | 312          |
| 4   | 292.0        | 297         | 294          |
| 5   | 274.2        | 279         | 276          |
| 6   | 256.2        | 261         | 258          |
| 7   | 238.0        | 243         | 240          |
| 8   | 220.7        | 226         | 223          |
| 9   | 203.8        | 209         | 206          |

Row pitch: ~18.2pt (average of rows 1–9).
`row_start_y = 347`, `row_pitch = 18.2`.

### HOH Certification (bottom of page)

Box spans pm_y=122.9 to pm_y=147.0. Labels:
- "Head of Household Signature" at x=79.7, y=128.9
- "Date" at x=428.3, y=129.0
- HOH cert box bottom: pm_y=122.9; top: pm_y=147.0

Signature image: x=80, y=132, width=150, height=12 (sits between label and box top).
Date text: x=468, y=143.

## Field Map Pattern: Pattern B (Templated Rows)

**Choice: Pattern B.** The table has 9 structurally identical rows with constant column x-positions
and a regular row pitch. Pattern B expresses all 9 rows as `row_start_y + i * row_pitch`,
requiring only one column definition instead of 54 individual field entries (9 rows × 6 fields).
Pattern B is also directly extensible to debts_owed_phas, obligations_of_family, and the main
application roster — all table-style forms with regular row pitch.

## Iteration History

| Iteration | Change | Result |
|-----------|--------|--------|
| 1 | hoh_sig y=133, h=13 | Signature overlaps body paragraph text above box — too high |
| 2 | hoh_sig y=138, h=13 | Still overlapping certification paragraph |
| 3 | hoh_sig y=148, h=13 | y=148 is 1pt above box top (box top = pm_y=147), too high |
| 4 (final) | hoh_sig y=132, h=12 | Signature sits inside HOH cert box, overlays label as expected for a filled form. PASS. |

Row members table required no iteration — first pass placed data correctly in all 5 rows.

## Verification

Visual verification via `scripts/render-stamped.py`:

```
python scripts/render-stamped.py --input docs/templates/citizenship-declaration-en-filled.pdf --output-dir scripts/output/render/ --dpi 150
```

Output: `scripts/output/render/citizenship-declaration-en-filled-page1.png`

Verified 2026-05-15: All 5 household members appear in the first 5 data rows. Names and DOBs
in the correct columns. Status checkboxes: Maria/Diego/Sofia/Lucas = column 1 (citizen), Carlos
= column 2 (eligible non-citizen). Signature images appear in the signature column for all rows.
HOH cert date "2026-05-15" appears in the Date cell. Source content (instructions, status
definitions 1/2/3, HACH letterhead, footer) unchanged. PASS.

## Spanish Field Labels (for cross-reference with ES map)

| EN label                              | field_name                  |
|---------------------------------------|-----------------------------|
| Family Member Name                    | full_name (member)          |
| Date of Birth                         | dob (member)                |
| Status 1 (citizen)                    | citizenship_status=citizen  |
| Status 2 (eligible immigration status)| citizenship_status=eligible_non_citizen |
| Status 3 (choose not to declare)      | citizenship_status=not_declaring |
| Signature                             | signature (member)          |
| Head of Household Signature           | hoh_certification_signature |
| Date                                  | hoh_certification_date      |
