import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

async function extractPages() {
  const sourcePath = path.join(process.cwd(), 'docs/templates/Full Application Package (5-28-2025 bilingual).pdf');
  const outputPath = path.join(process.cwd(), 'docs/templates/briefing-cert-source.pdf');

  console.log('Loading source PDF...');
  const sourceBytes = fs.readFileSync(sourcePath);
  const sourcePdf = await PDFDocument.load(sourceBytes);

  const totalPages = sourcePdf.getPageCount();
  console.log(`Source PDF has ${totalPages} pages`);

  // Pages are 0-indexed in pdf-lib, so page 37 = index 36, page 38 = index 37
  const pageIndices = [36, 37];

  console.log('Extracting pages 37-38...');
  const newPdf = await PDFDocument.create();

  for (const pageIndex of pageIndices) {
    if (pageIndex >= totalPages) {
      console.error(`Error: Page index ${pageIndex} exceeds total pages ${totalPages}`);
      process.exit(1);
    }
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
    newPdf.addPage(copiedPage);
  }

  console.log('Saving extracted PDF...');
  const newPdfBytes = await newPdf.save();
  fs.writeFileSync(outputPath, newPdfBytes);

  console.log(`✓ Extracted 2 pages to ${outputPath}`);
  console.log('  Page 1 (index 36): English version');
  console.log('  Page 2 (index 37): Spanish version');
}

extractPages().catch(err => {
  console.error('Extraction failed:', err);
  process.exit(1);
});
