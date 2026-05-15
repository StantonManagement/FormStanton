"""
Verify stamp-form output by comparing filled PDF text positions to source PDF positions.
Shows where stamped values landed relative to the form labels.
"""
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextBox, LTTextLine
from pdfminer.layout import LAParams
import sys

def extract_lines(pdf_path):
    laparams = LAParams(line_margin=0.5, word_margin=0.1)
    lines = []
    for page_layout in extract_pages(pdf_path, laparams=laparams):
        for element in page_layout:
            if isinstance(element, LTTextBox):
                for line in element:
                    if isinstance(line, LTTextLine):
                        text = line.get_text().strip()
                        if text:
                            x0, y0, x1, y1 = line.bbox
                            lines.append((y0, x0, x1, y1, text))
    lines.sort(key=lambda t: -t[0])
    return lines

source_path = "docs/templates/briefing-cert-en.pdf"
filled_path = "docs/templates/briefing-cert-en-filled.pdf"

print("=== SOURCE PDF TEXT POSITIONS (near signature area) ===")
source_lines = extract_lines(source_path)
sig_area = [(y0, x0, x1, y1, text) for y0, x0, x1, y1, text in source_lines if y0 < 250]
for y0, x0, x1, y1, text in sig_area:
    print(f"  y={y0:6.1f} (bbox_bottom) | x={x0:6.1f} | {text}")

print("\n=== FILLED PDF TEXT POSITIONS (near signature area) ===")
print("(Shows original labels + newly stamped values)")
filled_lines = extract_lines(filled_path)
sig_area_filled = [(y0, x0, x1, y1, text) for y0, x0, x1, y1, text in filled_lines if y0 < 260]
for y0, x0, x1, y1, text in sig_area_filled:
    is_new = text.strip() not in [t for _, _, _, _, t in source_lines]
    marker = "  >>> STAMPED <<<" if is_new else ""
    print(f"  y={y0:6.1f} | x={x0:6.1f} | {text}{marker}")

print("\n=== ANALYSIS ===")
label_y = 179.5  # "Head of Household Printed Name" bbox bottom from source
print(f"Label 'Head of Household Printed Name' bbox_bottom: y={label_y}")
print()
print("Interpretation:")
print("  If stamped name y > label_y: name is ABOVE the label (correct - on the line)")
print("  If stamped name y < label_y: name is BELOW the label (wrong - under the label)")
print()
for y0, x0, x1, y1, text in filled_lines:
    if "Maria Garcia-Rodriguez" in text:
        rel = "ABOVE label" if y0 > label_y else "BELOW label"
        gap = abs(y0 - label_y)
        print(f"  Stamped name found at y={y0:.1f} — {rel} by {gap:.1f}pt")
    if "2026-05-14" in text:
        date_label_y = 139.6
        rel = "ABOVE label" if y0 > date_label_y else "BELOW label"
        gap = abs(y0 - date_label_y)
        print(f"  Stamped date found at y={y0:.1f} — {rel} date label by {gap:.1f}pt")
