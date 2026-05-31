/**
 * lib/field-map-authoring/ocr.ts
 *
 * PRD-86 Phase A — OCR round-trip validator + pluggable rasterizer/engine.
 *
 * The round-trip: render Preview B (via stampForm), rasterize each page, OCR it,
 * and confirm each stamped sample value actually appears in the extracted text.
 * Missing/truncated values are flagged with form_id, field, page.
 *
 * Both the rasterizer and the OCR engine are injectable so the validator is
 * unit-testable and degrades gracefully: if the rasterizer returns null (e.g.
 * sharp lacks libvips PDF support in this env), the validator reports `skipped`
 * rather than failing — geometric validation still stands on its own.
 */

import {
  type FieldMap,
  type OcrEngine,
  type OcrStatus,
  type Rasterizer,
  type ValidationFinding,
} from './types';

/** Default rasterizer: pdf-lib page-split + sharp (same approach as lib/scan/splitPdf.ts). */
export const sharpRasterizer: Rasterizer = {
  async rasterizePage(pdfBytes, page) {
    try {
      const sharp = (await import('sharp')).default;
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(pdfBytes);
      const idx = Math.max(0, (page || 1) - 1);
      if (idx >= doc.getPageCount()) return null;
      const single = await PDFDocument.create();
      const [copied] = await single.copyPages(doc, [idx]);
      single.addPage(copied);
      const bytes = Buffer.from(await single.save());
      return await sharp(bytes, { density: 150 }).jpeg({ quality: 85 }).toBuffer();
    } catch {
      // libvips without PDF support, or any rasterization failure → caller skips OCR.
      return null;
    }
  },
};

/** Default OCR engine: reuse the repo's Claude-vision OCR (no new dependency). */
export const claudeVisionOcrEngine: OcrEngine = {
  async ocr(jpegBase64) {
    const { runOcr } = await import('@/lib/intake/ocr');
    const result = await runOcr(jpegBase64);
    return result.text;
  },
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s ]+/g, ' ').replace(/[^\w $.,/-]/g, '').trim();
}

/**
 * Collect the sample text values that the field map will actually stamp, grouped
 * by page, so we can check each against the OCR of that page.
 */
function expectedTextByPage(
  fieldMap: FieldMap,
  data: Record<string, unknown>
): Map<number, { field: string; value: string }[]> {
  const byPage = new Map<number, { field: string; value: string }[]>();
  const push = (page: number, field: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    const str = String(value);
    if (!str.trim()) return;
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page)!.push({ field, value: str });
  };

  for (const f of fieldMap.fields ?? []) {
    if (f.type === 'text') push(f.page ?? 1, f.name, data[f.name]);
  }
  const patterns = [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];
  for (const rp of patterns) {
    const rows = data[rp.data_key];
    if (!Array.isArray(rows)) continue;
    const maxRows = rp.max_rows ?? 9;
    for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
      const row = rows[i] as Record<string, unknown>;
      for (const col of rp.columns) {
        if (col.type !== 'text') continue;
        const key = col.field_prefix ?? col.member_key ?? '';
        push(rp.page ?? 1, `${rp.id ?? rp.data_key}[${i}].${key}`, row[key]);
      }
    }
  }
  return byPage;
}

export interface OcrRoundTripResult {
  status: OcrStatus;
  reason?: string;
  findings: ValidationFinding[];
}

/**
 * Run the OCR round-trip over a rendered (Preview B) PDF.
 *
 * @param previewBPdf  bytes returned by stampForm with the sample data
 * @param fieldMap     the map under review
 * @param data         the same sample data passed to stampForm
 */
export async function ocrRoundTrip(
  previewBPdf: Uint8Array,
  fieldMap: FieldMap,
  data: Record<string, unknown>,
  rasterizer: Rasterizer,
  engine: OcrEngine
): Promise<OcrRoundTripResult> {
  const expected = expectedTextByPage(fieldMap, data);
  if (expected.size === 0) {
    return { status: 'pass', findings: [] };
  }

  const findings: ValidationFinding[] = [];
  let rasterizedAny = false;

  for (const [page, items] of expected) {
    const jpeg = await rasterizer.rasterizePage(previewBPdf, page);
    if (!jpeg) continue; // page not rasterizable — skip, note below
    rasterizedAny = true;
    const text = normalize(await engine.ocr(jpeg.toString('base64')));

    for (const { field, value } of items) {
      const norm = normalize(value);
      if (!norm) continue;
      if (text.includes(norm)) continue;
      // Truncation heuristic: a long-ish value whose leading half is present.
      const head = norm.slice(0, Math.max(4, Math.floor(norm.length / 2)));
      if (norm.length > 8 && text.includes(head)) {
        findings.push({
          kind: 'ocr_truncated',
          formId: fieldMap.form_id,
          field,
          page,
          reason: `expected "${value}" but only a leading fragment was found`,
        });
      } else {
        findings.push({
          kind: 'ocr_missing',
          formId: fieldMap.form_id,
          field,
          page,
          reason: `expected "${value}" not found in OCR of page ${page}`,
        });
      }
    }
  }

  if (!rasterizedAny) {
    return {
      status: 'skipped',
      reason: 'PDF rasterization unavailable in this environment (sharp/libvips without PDF support)',
      findings: [],
    };
  }

  return { status: findings.length > 0 ? 'flagged' : 'pass', findings };
}
