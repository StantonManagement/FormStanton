import * as fs from 'fs';
import * as path from 'path';

// Using pdfjs-dist legacy build for Node.js
async function extractText() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');

  // Set up the worker
  const pdfPath = path.join(process.cwd(), 'docs/templates/briefing-cert-source.pdf');
  const data = new Uint8Array(fs.readFileSync(pdfPath));

  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  console.log(`PDF loaded. Pages: ${pdf.numPages}\n`);
  console.log('='.repeat(80));

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const textItems = textContent.items;

    console.log(`\n--- PAGE ${i} ---\n`);

    let lastY = -1;
    let text = '';

    for (const item of textItems) {
      const anyItem = item as any;
      if (anyItem.str) {
        // Add newline if Y position changed significantly
        if (lastY !== -1 && Math.abs(anyItem.transform[5] - lastY) > 5) {
          text += '\n';
        }
        text += anyItem.str;
        lastY = anyItem.transform[5];
      }
    }

    console.log(text);
    console.log('\n' + '='.repeat(80));
  }
}

extractText().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
