/**
 * Inspect PDF structure to find text content and positions.
 * Uses pdf-lib's low-level page content stream parsing.
 * Outputs raw text operators with coordinates for field mapping.
 */
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pdfPath = join(root, 'docs/templates/briefing-cert-en.pdf');
const pdfBytes = readFileSync(pdfPath);
const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

const page = pdfDoc.getPages()[0];
const { width, height } = page.getSize();
console.log(`\nPage size: ${width}pt × ${height}pt`);
console.log('PDF coordinate system: origin at bottom-left\n');

// Get raw content stream
const contentStream = page.node.Contents();
if (!contentStream) {
  console.error('No content stream found');
  process.exit(1);
}

// Decompress and decode the content stream
let rawContent = '';
try {
  // Try to get the raw stream bytes
  const streamRef = page.node.get(PDFName.of('Contents'));
  if (streamRef) {
    // Access through the indirect object
    const contents = pdfDoc.context.lookup(streamRef);
    if (contents && contents.constructor.name === 'PDFRawStream') {
      rawContent = Buffer.from(contents.contents).toString('latin1');
    } else if (contents && contents.constructor.name === 'PDFArray') {
      // Multiple content streams
      for (let i = 0; i < contents.size(); i++) {
        const ref = contents.get(i);
        const stream = pdfDoc.context.lookup(ref);
        if (stream && stream.contents) {
          rawContent += Buffer.from(stream.contents).toString('latin1');
        }
      }
    }
  }
} catch (e) {
  console.log('Direct stream access failed, trying alternate method:', e.message);
}

if (!rawContent) {
  console.log('Could not extract raw content stream directly.');
  console.log('Page dimensions are 612x790pt.');
  console.log('Falling back to manual coordinate estimation based on PDF spec.');
  process.exit(0);
}

console.log('=== RAW CONTENT STREAM (first 5000 chars) ===');
console.log(rawContent.substring(0, 5000));

// Parse Tj/TJ text operators with position context
// Look for: x y Td/TD/Tm followed eventually by text
const lines = rawContent.split('\n');
let currentX = 0, currentY = 0;
let textItems = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Td operator: relative move
  const tdMatch = line.match(/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Td$/);
  if (tdMatch) {
    currentX += parseFloat(tdMatch[1]);
    currentY += parseFloat(tdMatch[2]);
  }
  
  // Tm operator: absolute matrix (a b c d e f Tm)
  const tmMatch = line.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Tm$/);
  if (tmMatch) {
    currentX = parseFloat(tmMatch[5]);
    currentY = parseFloat(tmMatch[6]);
  }
  
  // Tj operator: show string
  const tjMatch = line.match(/\(([^)]+)\)\s*Tj$/);
  if (tjMatch) {
    textItems.push({ text: tjMatch[1], x: currentX, y: currentY });
  }
}

if (textItems.length > 0) {
  console.log('\n=== TEXT ITEMS WITH POSITIONS ===');
  console.log('(x, y are PDF points; y=0 at bottom, y=790 at top)');
  textItems.forEach(item => {
    const yFromTop = height - item.y;
    console.log(`  y=${item.y.toFixed(1)} (${yFromTop.toFixed(1)} from top)  x=${item.x.toFixed(1)}  "${item.text}"`);
  });
} else {
  console.log('\nNo text items extracted via Td/Tm parsing.');
  console.log('PDF may use compressed streams. Recommend using Python pdfminer or pdfrw for deeper inspection.');
}
