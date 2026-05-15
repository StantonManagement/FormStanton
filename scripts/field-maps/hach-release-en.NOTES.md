# hach-release — EN

**Source:** packet p 15, extracted to `hach-release-en.pdf` (1 page)
**Complexity:** Medium — 10 fields, 1 page
**Scope:** Per household — HOH required; Spouse + Other Adults optional

## Field Layout
Form is two-column. Left column: recipient (HACH) info, purposes, authorized sources. Right column (x=324): signature blocks.
- Name/Address at top of left column (filled from the top of the right panel, x=80)
- 4 signature blocks bottom-right: HOH → Spouse → Other Adult 1 → Other Adult 2
- Each block: signature line + printed name (image field) at x=324, Date at x=540

## Coordinate Method
pdfminer extraction. Signature label y-coords used as anchor; image placed 3px above label.

## Anomaly
- "Name" and "Address" fill areas are in the left column at x=80, y≈637/618 — these are blank underlines in the original form below the "To: HACH" header block. Confirmed from visual render.
- Empty signature slots (other_adult_2) omitted from sample data to avoid EISDIR error in stamp-form.mjs when value is empty string and type is image.

## Verification
Stamped and rendered — Name, Address, 3 signatures, 3 dates all land correctly. 4th sig block left blank as expected. Visual check passed.
