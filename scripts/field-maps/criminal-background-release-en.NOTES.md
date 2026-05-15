# criminal-background-release — EN

**Source:** packet p 39, extracted to `criminal-background-release-en.pdf` (1 page)
**Complexity:** Low — 19 fields, 1 page
**Scope:** Per adult (all household members 18+)

## Field Layout
Form has these sections (top to bottom):
1. Title block
2. Authorization text (3 paragraphs)
3. Applicant Information: First Name / Middle Initial / Last Name (inline label row)
4. Name suffix checkboxes + Date of Birth
5. Social Security Number (9-segment underscore pattern)
6. Current Address: street + apt (row), city + state + zip (row)
7. Previous Address: same structure
8. Signature + Date (underline)
9. Witness + Date (underline)
10. Footer note: "All family members 18 years or older must complete and sign this form"

## Coordinate Strategy
Labels are inline with fill areas (e.g., "First Name -" at x=72, fill area starts ~x=145).
All fill x-coords offset from label text by measuring label length.

## Verification
Stamped and rendered — all 19 fields render correctly. Name, SSN, addresses, sig all visible.
Visual check passed.
