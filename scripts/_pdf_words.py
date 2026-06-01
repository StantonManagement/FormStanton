"""Dump words from a PDF page in pdf-lib coordinate space (origin bottom-left).

Usage:
  python scripts/_pdf_words.py <pdf> <page_index> [xmin xmax ymin ymax]

Coordinates printed are pdf-lib space: x from left, y from BOTTOM (= page_h - pymupdf_y).
Filters are applied in pdf-lib space if provided.
"""
import sys
import io
import fitz

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

pdf = sys.argv[1]
page_idx = int(sys.argv[2])
xmin = float(sys.argv[3]) if len(sys.argv) > 3 else None
xmax = float(sys.argv[4]) if len(sys.argv) > 4 else None
ymin = float(sys.argv[5]) if len(sys.argv) > 5 else None
ymax = float(sys.argv[6]) if len(sys.argv) > 6 else None

doc = fitz.open(pdf)
page = doc[page_idx]
H = page.rect.height
words = page.get_text("words")  # x0,y0,x1,y1,word,block,line,word_no (top-left origin)

rows = []
for x0, y0, x1, y1, w, *_ in words:
    # pdf-lib: y measured from bottom. baseline ~ bottom of glyph = H - y1
    lib_y_bottom = H - y1
    lib_y_top = H - y0
    cx = (x0 + x1) / 2
    if xmin is not None and cx < xmin:
        continue
    if xmax is not None and cx > xmax:
        continue
    if ymin is not None and lib_y_bottom < ymin:
        continue
    if ymax is not None and lib_y_bottom > ymax:
        continue
    rows.append((round(lib_y_bottom, 1), round(x0, 1), round(x1, 1), w))

rows.sort(key=lambda r: (-r[0], r[1]))
for lib_y, x0, x1, w in rows:
    print(f"y={lib_y:>7}  x0={x0:>6}  x1={x1:>6}  {w}")
