# child-support-affidavit — EN

**Source:** packet p 17 (top half), extracted to `child-support-affidavit-en.pdf`
**Complexity:** Low — 8 fields, 1 page
**Scope:** HOH per adult who receives child support

## Field Layout
This form shares a page with `no-child-support-affidavit`. The child support affidavit occupies
the top half of the page (y > 430) and the no-child-support occupies the bottom half (y < 430).
Both forms use the same source PDF; field maps use different y-coordinate ranges.

## Coordinate Method
pdfminer extraction on extracted 1-page PDF. Labels at x=72; inline underline fields measured
by gap between label token end and next label token.

## Anomalies
- `affiant_address` and `affiant_zip` land slightly over their label text because the form uses
  inline labels directly on top of fill lines. Values readable above labels in stamped output.
- `children_names` placed on blank underline at y=580 (below the "certify that I receive" line).
- `amount_monthly` left empty in sample data (using weekly only).

## Field Name Mapping to Inventory
| Map field | Inventory field | Notes |
|---|---|---|
| `affiant_name` | `affiant_name` | matches |
| `affiant_address` | `affiant_address` | matches |
| `affiant_zip` | `affiant_zip` | matches |
| `children_names` | `children_names` | matches |
| `amount_weekly` | `amount_weekly` | matches |
| `amount_monthly` | `amount_monthly` | matches |
| `signature` | `signature` | matches |
| `signature_date` | `signature_date` | matches |

## Verification
Stamped `child-support-affidavit-en-filled.pdf` — all 8 fields render correctly.
Rendered `child-support-affidavit-en-filled-page1.png` — visual check passed.
