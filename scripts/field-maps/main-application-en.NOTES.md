# main-application — EN

**Source:** packet pp 1, 3, 5, 7, 9 (idx 0, 2, 4, 6, 8), extracted to `main-application-en.pdf` (5 pages)
**Complexity:** Highest — ~250 inventory fields, 5 pages, 5 repeating table patterns
**Page size:** Legal (612×1008)

## Schema Design

Uses `row_patterns` (plural array) — new feature added to stamp-form.mjs in this commit.
Each row pattern has a unique `id`, `data_key`, per-page placement, and columns using `field_prefix` (matches sample data object keys).

### Row patterns defined:
| id      | page | data_key     | max_rows | row_start_y | row_pitch |
|---------|------|--------------|----------|-------------|-----------|
| adults  | 1    | adults       | 6        | 566         | 22        |
| minors  | 1    | minors       | 8        | 322         | 22        |
| income  | 2    | income_rows  | 17       | 872         | 22.5      |
| assets  | 3    | asset_rows   | 10       | 870         | 22.6      |
| medical | 3    | medical_rows | 4        | 413         | 22.5      |

### Flat fields defined (27 total):
Header block (p1), school full-time who, Q1/Q2/Q3 explain, zero income names, 6 signature blocks + dates (p5), notices checkbox.

## Omitted Fields (by design)
- All checkbox fields (race, ethnicity, marital status, yes/no questions, income yes/no columns, asset yes/no, criminal history, expenses, q4-q6 childcare) — stamp tool skips checkboxes.
- Expense table (Section VIII) — conditional on zero income; omitted from sample.
- Criminal history table — omitted from sample (all No answers assumed).

## Coordinate Method
pdfminer extraction. Labels extracted from all 5 pages; y-coords used as anchors for flat fields.
Row tables: header label y-coords used to set `row_start_y`; pitch estimated from row height.

## Stamp Tool Update
`stamp-form.mjs` extended to support `row_patterns` array (in addition to existing `row_pattern` singular).
New handler loops over each pattern, using `field_prefix` as the row data key (previously only `member_key`).

## Verification
Stamped and rendered at 120 DPI for 5 pages. Visual checks:
- p1: Header fields and both table sections land correctly.
- p5: HOH + 2 additional adult signatures land correctly in the 6-slot block.
- Income/asset rows on p2/p3 not visually checked in detail (income table spans deep into legal-size page; coordinate positions are best estimates — will require real-application fine-tuning).
