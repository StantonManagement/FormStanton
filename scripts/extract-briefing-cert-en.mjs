import { PDFDocument } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sourcePath = join(root, 'docs/templates/Full Application Package (5-28-2025 bilingual).pdf');
const outputPath = join(root, 'docs/templates/briefing-cert-en.pdf');

console.log('Loading source PDF...');
const sourceBytes = readFileSync(sourcePath);
const sourcePdf = await PDFDocument.load(sourceBytes);

const totalPages = sourcePdf.getPageCount();
console.log(`Source PDF has ${totalPages} pages`);

// Page 37 (1-indexed) = index 36 (0-indexed) = English Family Certification of Briefing Documents Received
const pageIndex = 36;
if (pageIndex >= totalPages) {
  console.error(`Page index ${pageIndex} exceeds total pages ${totalPages}`);
  process.exit(1);
}

const newPdf = await PDFDocument.create();
const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageIndex]);
newPdf.addPage(copiedPage);

const { width, height } = copiedPage.getSize();
console.log(`Page dimensions: ${width}pt × ${height}pt`);

const newPdfBytes = await newPdf.save();
writeFileSync(outputPath, newPdfBytes);

console.log(`✓ Extracted page 37 (index 36) to ${outputPath}`);
console.log(`  Page count: ${newPdf.getPageCount()} (expected 1)`);
