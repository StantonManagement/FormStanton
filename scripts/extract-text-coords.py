"""
Extract text items with their PDF coordinate positions from briefing-cert-en.pdf.
Uses pdfminer.six which properly decompresses and parses PDF content streams.
PDF coordinate space: origin at bottom-left, y increases upward.
"""
import sys
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextBox, LTTextLine, LTChar
from pdfminer.layout import LAParams

pdf_path = "docs/templates/briefing-cert-en.pdf"

print(f"Extracting coordinates from: {pdf_path}\n")

laparams = LAParams(line_margin=0.5, word_margin=0.1)

for page_num, page_layout in enumerate(extract_pages(pdf_path, laparams=laparams), 1):
    page_height = page_layout.height
    page_width = page_layout.width
    print(f"Page {page_num}: {page_width:.1f}pt x {page_height:.1f}pt")
    print(f"(y=0 at bottom; y={page_height:.0f} at top)\n")
    
    # Collect all text lines with positions
    lines = []
    for element in page_layout:
        if isinstance(element, LTTextBox):
            for line in element:
                if isinstance(line, LTTextLine):
                    text = line.get_text().strip()
                    if text:
                        x0, y0, x1, y1 = line.bbox
                        lines.append((y0, x0, x1, y1, text))
    
    # Sort by y descending (top of page first)
    lines.sort(key=lambda t: -t[0])
    
    print("=== ALL TEXT LINES (y from bottom, top of page first) ===")
    for y0, x0, x1, y1, text in lines:
        print(f"  y={y0:6.1f} | x={x0:6.1f}..{x1:5.1f} | {text}")
    
    print("\n=== KEYWORD MATCHES (name/signature/date/household) ===")
    keywords = ['name', 'signature', 'date', 'head', 'household', 'printed', 'sign']
    for y0, x0, x1, y1, text in lines:
        if any(kw in text.lower() for kw in keywords):
            print(f"  *** y={y0:6.1f} | x={x0:6.1f} | {text}")
