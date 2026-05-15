/**
 * stamp-form.mjs
 * Stamps a source PDF with tenant data at field-map coordinates.
 *
 * Usage:
 *   node scripts/stamp-form.mjs --form briefing-cert-en --data scripts/sample-data/briefing-cert-en.json --out docs/templates/briefing-cert-en-filled.pdf
 *
 * Args:
 *   --form  Form ID (resolves to scripts/field-maps/<form>.json and the source_pdf inside it)
 *   --data  Path to JSON file with field values (relative to project root)
 *   --out   Output PDF path (relative to project root)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// --- Parse CLI args ---
const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) {
    console.error(`Missing required argument: --${name}`);
    process.exit(1);
  }
  return args[idx + 1];
}

const formId = getArg('form');
const dataPath = getArg('data');
const outPath = getArg('out');

// --- Load field map ---
const fieldMapPath = join(root, 'scripts', 'field-maps', `${formId}.json`);
if (!existsSync(fieldMapPath)) {
  console.error(`Field map not found: ${fieldMapPath}`);
  process.exit(1);
}
const fieldMap = JSON.parse(readFileSync(fieldMapPath, 'utf8'));
console.log(`Loaded field map: ${fieldMapPath}`);
console.log(`  Form: ${fieldMap.form_id}`);
console.log(`  Source PDF: ${fieldMap.source_pdf}`);
console.log(`  Fields: ${fieldMap.fields.length}`);

// --- Load source PDF ---
const sourcePdfPath = join(root, fieldMap.source_pdf);
if (!existsSync(sourcePdfPath)) {
  console.error(`Source PDF not found: ${sourcePdfPath}`);
  process.exit(1);
}
const sourcePdfBytes = readFileSync(sourcePdfPath);
const pdfDoc = await PDFDocument.load(sourcePdfBytes);
console.log(`\nLoaded source PDF: ${sourcePdfPath}`);
console.log(`  Pages: ${pdfDoc.getPageCount()}`);

// --- Load data file ---
const absDataPath = resolve(root, dataPath);
if (!existsSync(absDataPath)) {
  console.error(`Data file not found: ${absDataPath}`);
  process.exit(1);
}
const data = JSON.parse(readFileSync(absDataPath, 'utf8'));
console.log(`\nLoaded data file: ${absDataPath}`);
console.log(`  Keys: ${Object.keys(data).join(', ')}`);

// --- Embed standard font ---
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

// --- Stamp row_patterns (plural array) if present ---
if (Array.isArray(fieldMap.row_patterns)) {
  for (const rp of fieldMap.row_patterns) {
    const rows = data[rp.data_key];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`\n[SKIP] row_patterns["${rp.id}"] — key="${rp.data_key}" empty or missing`);
      continue;
    }
    console.log(`\nStamping row_patterns["${rp.id}"] (${rows.length} rows, key="${rp.data_key}"):`);
    for (let i = 0; i < Math.min(rows.length, rp.max_rows ?? 9); i++) {
      const row = rows[i];
      const rowY = rp.row_start_y - i * rp.row_pitch;
      for (const col of rp.columns) {
        const key = col.field_prefix ?? col.member_key;
        const value = row[key];
        if (value === undefined || value === null || value === '') {
          console.log(`  [SKIP] row ${i + 1} ${key} — empty`);
          continue;
        }
        const pageIndex = (rp.page || 1) - 1;
        const page = pdfDoc.getPages()[pageIndex];
        if (col.type === 'text') {
          page.drawText(String(value), {
            x: col.x,
            y: rowY + (col.y_offset ?? 5),
            size: col.font_size || 9,
            font,
            color: rgb(0, 0, 0),
          });
          console.log(`  [TEXT] row ${i + 1} ${key} = "${value}" @ x=${col.x}, y=${rowY + (col.y_offset ?? 5)}`);
        } else if (col.type === 'checkbox') {
          const checked = value === col.check_value;
          if (checked) {
            page.drawText('X', { x: col.x, y: rowY + (col.y_offset ?? 5), size: col.font_size || 9, font, color: rgb(0, 0, 0) });
            console.log(`  [CHECK] row ${i + 1} ${key} = X @ x=${col.x}, y=${rowY + (col.y_offset ?? 5)}`);
          } else {
            console.log(`  [SKIP] row ${i + 1} ${key} — not checked`);
          }
        }
      }
    }
  }
}

// --- Stamp row_pattern fields (table rows) if present ---
if (fieldMap.row_pattern) {
  const rp = fieldMap.row_pattern;
  const members = data[rp.data_key];
  if (!Array.isArray(members)) {
    console.error(`row_pattern.data_key "${rp.data_key}" not found or not an array in data file`);
    process.exit(1);
  }
  console.log(`\nStamping row_pattern (${members.length} rows, key="${rp.data_key}"):`);
  for (let i = 0; i < Math.min(members.length, rp.max_rows ?? 9); i++) {
    const member = members[i];
    const rowY = rp.row_start_y - i * rp.row_pitch;
    for (const col of rp.columns) {
      const value = member[col.member_key];
      if (value === undefined || value === null) {
        console.log(`  [SKIP] row ${i + 1} ${col.member_key} — no value`);
        continue;
      }
      const pageIndex = (rp.page || 1) - 1;
      const page = pdfDoc.getPages()[pageIndex];
      if (col.type === 'text') {
        page.drawText(String(value), {
          x: col.x,
          y: rowY + (col.y_offset ?? 5),
          size: col.font_size || 9,
          font,
          color: rgb(0, 0, 0),
        });
        console.log(`  [TEXT] row ${i + 1} ${col.member_key} = "${value}" @ x=${col.x}, y=${rowY + (col.y_offset ?? 5)}`);
      } else if (col.type === 'checkbox') {
        const checked = value === col.check_value;
        if (checked) {
          page.drawText('X', {
            x: col.x,
            y: rowY + (col.y_offset ?? 5),
            size: col.font_size || 9,
            font,
            color: rgb(0, 0, 0),
          });
          console.log(`  [CHECK] row ${i + 1} ${col.member_key} = X @ x=${col.x}, y=${rowY + (col.y_offset ?? 5)}`);
        } else {
          console.log(`  [SKIP] row ${i + 1} ${col.member_key} — not checked (value="${value}", check_value="${col.check_value}")`);
        }
      } else if (col.type === 'image') {
        const imagePath = resolve(root, String(value));
        if (!existsSync(imagePath)) {
          console.error(`  [ERROR] Image not found: ${imagePath}`);
          continue;
        }
        const imageBytes = readFileSync(imagePath);
        const ext = imagePath.toLowerCase().split('.').pop();
        let embeddedImage;
        if (ext === 'png') {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else if (ext === 'jpg' || ext === 'jpeg') {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        } else {
          console.error(`  [ERROR] Unsupported image format: ${ext}`);
          continue;
        }
        const imgH = col.height || 13;
        page.drawImage(embeddedImage, {
          x: col.x,
          y: rowY + (col.y_offset ?? 2),
          width: col.width || 150,
          height: imgH,
        });
        console.log(`  [IMAGE] row ${i + 1} ${col.member_key} @ x=${col.x}, y=${rowY + (col.y_offset ?? 2)}`);
      }
    }
  }
}

// --- Stamp each field ---
console.log('\nStamping fields:');
for (const field of fieldMap.fields) {
  const value = data[field.name];
  if (value === undefined || value === null) {
    console.log(`  [SKIP] ${field.name} — no value in data file`);
    continue;
  }

  const pageIndex = (field.page || 1) - 1;
  const page = pdfDoc.getPages()[pageIndex];
  if (!page) {
    console.error(`  [ERROR] Page ${field.page} not found in PDF`);
    continue;
  }

  if (field.type === 'text') {
    page.drawText(String(value), {
      x: field.x,
      y: field.y,
      size: field.font_size || 11,
      font,
      color: rgb(0, 0, 0),
    });
    console.log(`  [TEXT] ${field.name} = "${value}" @ x=${field.x}, y=${field.y}`);

  } else if (field.type === 'image') {
    // value should be a path to a PNG (relative to project root)
    const imagePath = resolve(root, String(value));
    if (!existsSync(imagePath)) {
      console.error(`  [ERROR] Image not found: ${imagePath}`);
      continue;
    }
    const imageBytes = readFileSync(imagePath);
    const ext = imagePath.toLowerCase().split('.').pop();
    let embeddedImage;
    if (ext === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else if (ext === 'jpg' || ext === 'jpeg') {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      console.error(`  [ERROR] Unsupported image format: ${ext} for field ${field.name}`);
      continue;
    }
    page.drawImage(embeddedImage, {
      x: field.x,
      y: field.y,
      width: field.width || 200,
      height: field.height || 50,
    });
    console.log(`  [IMAGE] ${field.name} = "${value}" @ x=${field.x}, y=${field.y}, w=${field.width}, h=${field.height}`);
  } else {
    console.log(`  [SKIP] ${field.name} — unknown type: ${field.type}`);
  }
}

// --- Save output ---
const absOutPath = resolve(root, outPath);
const pdfBytes = await pdfDoc.save();
writeFileSync(absOutPath, pdfBytes);
console.log(`\n✓ Output saved to: ${absOutPath}`);
console.log(`  Size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
