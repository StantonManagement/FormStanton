"""Dump vector rectangles + lines from a PDF page in pdf-lib coords (origin bottom-left).

Usage: python scripts/_pdf_rects.py <pdf> <page_index> [xmin xmax ymin ymax]
Reports small rects (likely checkboxes) and vertical/horizontal line segments.
"""
import sys
import fitz

pdf = sys.argv[1]
page_idx = int(sys.argv[2])
xmin = float(sys.argv[3]) if len(sys.argv) > 3 else None
xmax = float(sys.argv[4]) if len(sys.argv) > 4 else None
ymin = float(sys.argv[5]) if len(sys.argv) > 5 else None
ymax = float(sys.argv[6]) if len(sys.argv) > 6 else None

doc = fitz.open(pdf)
page = doc[page_idx]
H = page.rect.height

def inband(cx, cy):
    if xmin is not None and cx < xmin: return False
    if xmax is not None and cx > xmax: return False
    if ymin is not None and cy < ymin: return False
    if ymax is not None and cy > ymax: return False
    return True

rects = []
for d in page.get_drawings():
    for item in d["items"]:
        if item[0] == "re":
            r = item[1]
            cx = (r.x0 + r.x1) / 2
            cy_lib = H - (r.y0 + r.y1) / 2
            w = abs(r.x1 - r.x0); h = abs(r.y1 - r.y0)
            if inband(cx, cy_lib):
                rects.append(("RECT", round(H - r.y1, 1), round(H - r.y0, 1), round(r.x0, 1), round(r.x1, 1), round(w, 1), round(h, 1)))
        elif item[0] == "l":
            p1, p2 = item[1], item[2]
            cx = (p1.x + p2.x) / 2
            cy_lib = H - (p1.y + p2.y) / 2
            if inband(cx, cy_lib):
                rects.append(("LINE", round(H - p1.y, 1), round(H - p2.y, 1), round(p1.x, 1), round(p2.x, 1), 0, 0))

rects.sort(key=lambda r: (-r[1], r[3]))
for kind, y_bot, y_top, x0, x1, w, h in rects:
    print(f"{kind} yb={y_bot:>7} yt={y_top:>7} x0={x0:>6} x1={x1:>6} w={w:>5} h={h:>5}")
