# Field Map Notes: briefing-cert-en

## Method Used

**Method B (hybrid): pdfminer text position extraction**

Used `scripts/extract-text-coords.py` (Python + pdfminer.six) to extract all text items with their
exact bounding boxes from `briefing-cert-en.pdf`. The pdfjs-dist Node.js package was not available
in a usable form (webpack-only build), so Python/pdfminer was the reliable path.

## PDF Coordinate Space

- Page: 612pt × 790pt (standard letter, but 2pt shorter than 792 — HACH's template)
- Origin: **bottom-left** (0,0) — y increases upward
- pdf-lib uses the same bottom-left convention

## Label Positions Found (from pdfminer extraction)

```
y= 179.5 | x=  72.0 | "Head of Household Printed Name"   (label baseline)
y= 179.5 | x= 324.2 | "Signature"                         (label baseline)
y= 139.6 | x=  72.0 | "Date"                              (label baseline)
```

## Field Position Reasoning

In the HACH briefing cert form, the layout for each signature field is:
  [fill line / underline]
  [label below the underline]

This means the label baseline (y=179.5) is BELOW the underline, and tenant content
goes ABOVE the label on the fill line. The underline for Name/Signature is estimated
at y≈183-185 (3-6pt above the label baseline), so fill text/images are placed at
y=187 (text) or y=183 (image bottom) to land just on or just above the underline.

For Date (label at y=139.6), underline estimated at y≈143-145, text placed at y=147.

## Iteration History

| Iteration | Change | Result |
|-----------|--------|--------|
| 1 (initial) | Name: y=187 x=72, Sig: y=183 x=324, Date: y=147 x=72 | TBD — see filled PDF |

## Tooling

- `scripts/extract-text-coords.py` — pdfminer extraction script
- `scripts/extract-text-coords.mjs` — attempted pdf-lib raw stream parse (abandoned: compressed streams)
- `scripts/stamp-form.mjs` — stamping script

## Notes for Future Forms

1. Always run `extract-text-coords.py` first to get label positions
2. Labels are typically 3-6pt below the underline (PDF bottom-left coords, so label y < underline y)
3. Place text at `label_y + 8-10` as starting estimate; signature image bottom at `label_y + 3-4`
4. If text appears below the line: increase y. If above: decrease y.
5. HACH forms use 612×790pt (not 792pt) — confirm page dimensions for each form before mapping
