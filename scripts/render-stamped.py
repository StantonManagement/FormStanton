"""
render-stamped.py
Renders each page of a PDF to a PNG file using pymupdf.

Language choice: Python — pymupdf is a Python library; calling it from Python directly
is simpler and faster than spawning a subprocess from Node. No additional npm dependencies.

Usage:
    python scripts/render-stamped.py --input <pdf_path> [--output-dir <dir>] [--dpi <int>]

Args:
    --input       Path to input PDF (required)
    --output-dir  Directory to write PNGs into (default: scripts/output/render/)
    --dpi         Render resolution in DPI (default: 150)

Output:
    One PNG per page named {input_basename}-page{n}.png (1-indexed).
    Exits non-zero with a stderr message on any failure.
"""
import sys
import os
import argparse

def main():
    parser = argparse.ArgumentParser(description="Render PDF pages to PNG via pymupdf")
    parser.add_argument("--input", required=True, help="Path to input PDF")
    parser.add_argument("--output-dir", default="scripts/output/render/", help="Output directory for PNGs")
    parser.add_argument("--dpi", type=int, default=150, help="Render DPI (default: 150)")
    args = parser.parse_args()

    pdf_path = args.input
    output_dir = args.output_dir
    dpi = args.dpi

    if not os.path.isfile(pdf_path):
        print(f"ERROR: Input PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    try:
        import fitz
    except ImportError:
        print("ERROR: pymupdf not installed. Run: pip install pymupdf --break-system-packages", file=sys.stderr)
        sys.exit(1)

    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"ERROR: Could not open PDF: {e}", file=sys.stderr)
        sys.exit(1)

    basename = os.path.splitext(os.path.basename(pdf_path))[0]
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)

    print(f"Rendering: {pdf_path}")
    print(f"  Pages: {doc.page_count}  DPI: {dpi}  Output: {output_dir}")

    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out_name = f"{basename}-page{i}.png"
        out_path = os.path.join(output_dir, out_name)
        try:
            pix.save(out_path)
        except Exception as e:
            print(f"ERROR: Could not save page {i}: {e}", file=sys.stderr)
            sys.exit(1)
        print(f"  [page {i}] -> {out_path}  ({pix.width}x{pix.height}px)")

    page_count = doc.page_count
    doc.close()
    print(f"\n✓ {page_count} page(s) rendered to {output_dir}")

if __name__ == "__main__":
    main()
