# obligations-of-family — EN

**Source:** packet p 23, extracted to `obligations-of-family-en.pdf` (1 page)
**Complexity:** Medium-High — 5 fields, 1 page
**Scope:** HOH only (`signer_scope = hoh_only`)

## Field Layout
Full page is acknowledgment text. Bottom section has two label rows:
- Row 1: "Head of Household Signature" (x=36) | "Phone" (x=396)
- Row 2: "Head of Household" (printed name, x=36) | "Date" (x=396)
- Row 3: "Address" (full width, x=36)

Signature row is above printed name row (lower y = closer to bottom of page in PDF coordinate space).

## Coordinate Method
pdfminer extraction. Label text y-coords used as anchors.
- hoh_signature image placed at y=183 (just above signature label y=178.6)
- hoh_name text placed at y=199 (just above name label y=195)
- hoh_address at y=166 (just above address label y=162)

## Verification
Stamped and rendered — all 5 fields land correctly in the bottom fill block. Visual check passed.
