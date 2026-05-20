# Field Map Notes: briefing-cert-es

## Source Extraction

Page 38 of `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` extracted using
pymupdf (`fitz.open` + `insert_pdf(from_page=37, to_page=37)`) → `docs/templates/briefing-cert-es.pdf`.

## PDF Coordinate Space

- Page: 612pt × 790pt — **byte-identical dimensions to EN** (612×790pt, same 2pt-short-of-letter quirk)
- Origin: bottom-left (0,0), y increases upward

## Label Positions (from pdfminer extraction)

```
y= 187.8 | x=  72.0 | "Nombre impreso del Jefe de la Familia"   (label baseline)
y= 187.8 | x= 288.1 | "Firma"                                    (label baseline)
y= 149.2 | x=  72.0 | "Fecha"                                    (label baseline)
```

## Coordinate Comparison: ES vs EN

| Field          | EN label y | ES label y | Δ      |
|----------------|-----------|-----------|--------|
| Name label     | 179.5     | 187.8     | +8.3pt |
| Signature label| 179.5     | 187.8     | +8.3pt |
| Date label     | 139.6     | 149.2     | +9.6pt |

The ES form is **not byte-identical** to EN — labels sit ~8–10pt higher on the page. This is
consistent with Spanish text being slightly more verbose (e.g. "Nombre impreso del Jefe de la
Familia" vs "Head of Household Printed Name"), which compresses the body text and shifts the
signature block upward. Separate ES field map is required and justified.

## Field Position Reasoning

Same offset logic as EN: label is below the underline; text placed ~14pt above label baseline;
signature image bottom ~4pt above label baseline.

- `hoh_printed_name`: label y=187.8 → text at y=202 (14.2pt above label)
- `signature`: label y=187.8 → image bottom at y=192 (4.2pt above label), height=30, top=222
- `signature_date`: label y=149.2 → text at y=163 (13.8pt above label)

Body text ends at y=226.4 ("de esa ausensia."). Signature image top=222, clearance=4pt. Acceptable.

## Iteration History

| Iteration | Change | Result |
|-----------|--------|--------|
| 1 (final) | Name: y=202 x=72, Sig: y=192 h=30 x=324, Date: y=163 x=72 | PASS — first attempt, no iteration needed |

## Verification

Re-run pdfminer on filled PDF to confirm stamped text coordinates:

```
python scripts/extract-text-coords.py  (modify pdf_path to briefing-cert-es-filled.pdf)
```

Expected: `hoh_printed_name` bbox_bottom ≈ y=199–200 (just above fill line); `signature_date`
bbox_bottom ≈ y=160.

Visual verification via `scripts/render-stamped.py`:

```
python scripts/render-stamped.py --input docs/templates/briefing-cert-es-filled.pdf --output-dir scripts/output/render/ --dpi 150
```

Output: `scripts/output/render/briefing-cert-es-filled-page1.png`

Verified 2026-05-15: "Maria Garcia-Rodriguez" on the "Nombre impreso" underline; cursive signature
within the "Firma" box; "2026-05-14" on the "Fecha" line. Spanish source content (HACH letterhead,
8 numbered documents in Spanish, obligations bullets, footer legal text, Rev 3/28/2025) unchanged.
PASS on first iteration.

## Spanish Field Labels (mapped to EN field_name keys)

| field_name       | ES label on form                            |
|------------------|---------------------------------------------|
| hoh_printed_name | Nombre impreso del Jefe de la Familia       |
| signature        | Firma                                       |
| signature_date   | Fecha                                       |
