import sys
import os

# Try different PDF libraries
try:
    from pdfminer.high_level import extract_text
    print("Using pdfminer.six")
except ImportError:
    try:
        import PyPDF2
        print("Using PyPDF2")
    except ImportError:
        print("Error: No PDF library available. Install with: pip install pdfminer.six")
        sys.exit(1)

pdf_path = "docs/templates/briefing-cert-source.pdf"

if not os.path.exists(pdf_path):
    print(f"Error: PDF not found at {pdf_path}")
    sys.exit(1)

print(f"\n{'='*80}")
print(f"Extracting text from: {pdf_path}")
print(f"{'='*80}\n")

# Try pdfminer first
try:
    from pdfminer.high_level import extract_text
    for page_num in range(1, 3):  # Pages 1 and 2
        print(f"\n{'='*80}")
        print(f"PAGE {page_num}")
        print(f"{'='*80}\n")
        text = extract_text(pdf_path, page_numbers=[page_num-1])  # 0-indexed
        print(text)
except Exception as e:
    print(f"pdfminer error: {e}")
    # Fallback to PyPDF2
    try:
        import PyPDF2
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for i, page in enumerate(reader.pages, 1):
                print(f"\n{'='*80}")
                print(f"PAGE {i}")
                print(f"{'='*80}\n")
                print(page.extract_text())
    except Exception as e2:
        print(f"PyPDF2 error: {e2}")
        sys.exit(1)

print(f"\n{'='*80}")
print("Extraction complete")
