/**
 * Extract text items with their PDF coordinate positions from briefing-cert-en.pdf.
 * Uses pdfjs-dist (already installed) which decompresses and parses the content streams.
 * The transform matrix [a,b,c,d,e,f] where e=x, f=y in PDF user space.
 * pdfjs uses top-left origin; we convert to PDF bottom-left for pdf-lib compatibility.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const require = createRequire(import.meta.url);

// Use legacy CJS build
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const pdfPath = join(root, 'docs/templates/briefing-cert-en.pdf');
const data = new Uint8Array(readFileSync(pdfPath));

const loadingTask = pdfjs.getDocument({ data });
const pdf = await loadingTask.promise;

console.log(`PDF loaded. Pages: ${pdf.numPages}`);

const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 1.0 });
const pageHeight = viewport.height; // in PDF points

console.log(`Viewport: ${viewport.width}pt x ${viewport.height}pt\n`);

const textContent = await page.getTextContent();
const items = textContent.items;

console.log('=== ALL TEXT ITEMS WITH COORDINATES ===');
console.log('Format: y_from_bottom | x | text');
console.log('(y=0 at bottom; typical letter page = 790pt tall)\n');

// Group by approximate Y (within 3pt = same line)
const lines = new Map();
for (const item of items) {
  if (!item.str || item.str.trim() === '') continue;
  // pdfjs transform[4]=x, transform[5]=y (from bottom in PDF space)
  const x = item.transform[4];
  const y = item.transform[5];
  const yKey = Math.round(y / 3) * 3; // bucket to 3pt groups
  if (!lines.has(yKey)) lines.set(yKey, []);
  lines.get(yKey).push({ x, y, text: item.str });
}

// Sort by y descending (top of page first)
const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0]);

for (const [yKey, lineItems] of sorted) {
  // Sort items in line by x
  lineItems.sort((a, b) => a.x - b.x);
  const lineText = lineItems.map(i => i.str).join('');
  const y = lineItems[0].y;
  const x = lineItems[0].x;
  console.log(`y=${y.toFixed(1).padStart(6)} | x=${x.toFixed(1).padStart(6)} | ${lineText}`);
}

console.log('\n=== SIGNATURE / DATE AREA — look for lines near bottom of form ===');
console.log('Target lines containing "Name", "Signature", "Date", "Head", "Household"');
const keywords = ['name', 'signature', 'date', 'head', 'household', 'printed', 'sign'];
for (const [yKey, lineItems] of sorted) {
  lineItems.sort((a, b) => a.x - b.x);
  const lineText = lineItems.map(i => i.str).join('').toLowerCase();
  if (keywords.some(kw => lineText.includes(kw))) {
    const y = lineItems[0].y;
    const x = lineItems[0].x;
    const display = lineItems.map(i => i.str).join('');
    console.log(`  y=${y.toFixed(1).padStart(6)} | x=${x.toFixed(1).padStart(6)} | >>> ${display} <<<`);
  }
}
