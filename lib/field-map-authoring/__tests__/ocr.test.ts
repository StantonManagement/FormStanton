import { describe, it, expect } from 'vitest';
import { ocrRoundTrip } from '@/lib/field-map-authoring/ocr';
import type { FieldMap, OcrEngine, Rasterizer } from '@/lib/field-map-authoring/types';

const DUMMY_PDF = new Uint8Array([1, 2, 3]);

const okRasterizer: Rasterizer = {
  async rasterizePage() {
    return Buffer.from('fake-jpeg');
  },
};
const nullRasterizer: Rasterizer = {
  async rasterizePage() {
    return null;
  },
};
function engineReturning(text: string): OcrEngine {
  return { async ocr() { return text; } };
}

const MAP: FieldMap = {
  form_id: 'main_application',
  source_pdf: 's',
  fields: [
    { name: 'applicant_full_name', type: 'text', page: 1, x: 72, y: 700, width: 200 },
    { name: 'phone_cell', type: 'text', page: 1, x: 72, y: 680, width: 120 },
  ],
};
const DATA = { applicant_full_name: 'Mia Lozada', phone_cell: '860-555-1234' };

describe('ocrRoundTrip', () => {
  it('passes when OCR text contains every stamped value', async () => {
    const engine = engineReturning('Applicant: Mia Lozada  Phone: 860-555-1234');
    const result = await ocrRoundTrip(DUMMY_PDF, MAP, DATA, okRasterizer, engine);
    expect(result.status).toBe('pass');
    expect(result.findings).toEqual([]);
  });

  it('flags a value missing from the OCR text', async () => {
    const engine = engineReturning('Applicant: Mia Lozada'); // phone missing
    const result = await ocrRoundTrip(DUMMY_PDF, MAP, DATA, okRasterizer, engine);
    expect(result.status).toBe('flagged');
    expect(result.findings.some((f) => f.field === 'phone_cell' && f.kind === 'ocr_missing')).toBe(true);
  });

  it('skips gracefully when the page cannot be rasterized', async () => {
    const engine = engineReturning('anything');
    const result = await ocrRoundTrip(DUMMY_PDF, MAP, DATA, nullRasterizer, engine);
    expect(result.status).toBe('skipped');
    expect(result.reason).toMatch(/rasterization unavailable/i);
    expect(result.findings).toEqual([]);
  });

  it('passes trivially when there is no text to verify', async () => {
    const emptyMap: FieldMap = { form_id: 'x', source_pdf: 's', fields: [] };
    const result = await ocrRoundTrip(DUMMY_PDF, emptyMap, {}, okRasterizer, engineReturning(''));
    expect(result.status).toBe('pass');
  });
});
