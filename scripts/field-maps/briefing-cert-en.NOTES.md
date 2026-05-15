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
| 1 (initial) | Name: y=187 x=72, Sig: y=183 h=40 x=324, Date: y=147 x=72 | Text below labels — wrong. Labels are below fill lines. |
| 2 | Name: y=194, Sig: y=188 h=40, Date: y=154 | pdfminer verify: Name detected at y=191.7 (12.2pt above label ✓), Date at y=151.7 (12.1pt above label ✓). Sig image top at y=228 overlaps body text at y=218. |
| 3 (final) | Sig: y=183 h=30 (top=213, 5pt below body text) | All three fields verified by pdfminer extraction of filled PDF. PASS. |

## Final Verified Positions

```
y=218.0  "start of that absence."  [body text ends]
y=213.0  [signature image top, 5pt clearance]
y=194.0  → hoh_printed_name text placed here (bbox_bottom=191.7)
y=183.0  [signature image bottom]
y=179.5  "Head of Household Printed Name" label
y=179.5  "Signature" label
y=154.0  → signature_date text placed here (bbox_bottom=151.7)
y=139.6  "Date" label
```

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
