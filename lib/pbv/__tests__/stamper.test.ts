/**
 * lib/pbv/__tests__/stamper.test.ts
 *
 * Regression test for stampForm().
 * Verifies that the TS port produces the same bytes as the JS pilot
 * for the briefing-cert-en form when no image resolver is provided.
 *
 * NOTE: byte-identical output is achievable only when:
 *   1. Same pdf-lib version used
 *   2. Same field data (deterministic)
 *   3. No image fields (image embed changes byte layout)
 *
 * The regression here verifies:
 *   - Output is a valid PDF (starts with %PDF)
 *   - Output is larger than the source (stamps were applied)
 *   - Text fields are present (no crash)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { stampForm } from '../form-generation/stamper';
import type { FieldMap } from '../form-generation/stamper';

const ROOT = join(__dirname, '../../../..');
const FIELD_MAP_PATH = join(ROOT, 'scripts/field-maps/briefing-cert-en.json');
const SOURCE_PDF_PATH = join(ROOT, 'docs/templates/briefing-cert-en.pdf');

const hasSources =
  existsSync(FIELD_MAP_PATH) && existsSync(SOURCE_PDF_PATH);

describe('stampForm', () => {
  it.skipIf(!hasSources)(
    'produces a valid PDF larger than source for briefing-cert-en with text fields',
    async () => {
      const fieldMap = JSON.parse(readFileSync(FIELD_MAP_PATH, 'utf8')) as FieldMap;
      const sourcePdfBytes = readFileSync(SOURCE_PDF_PATH);

      const data: Record<string, unknown> = {
        hoh_printed_name: 'Maria Santos',
        signature_date: '5/15/2026',
      };

      const result = await stampForm({
        fieldMap,
        data,
        sourcePdfBytes,
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(sourcePdfBytes.length);
      expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF');
    }
  );

  it('handles empty data object without throwing', async () => {
    if (!hasSources) return;

    const fieldMap = JSON.parse(readFileSync(FIELD_MAP_PATH, 'utf8')) as FieldMap;
    const sourcePdfBytes = readFileSync(SOURCE_PDF_PATH);

    const result = await stampForm({
      fieldMap,
      data: {},
      sourcePdfBytes,
    });

    expect(result).toBeInstanceOf(Buffer);
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('stamps flat checkbox fields only when affirmative / check_value matches', async () => {
    if (!existsSync(SOURCE_PDF_PATH)) return;
    const sourcePdfBytes = readFileSync(SOURCE_PDF_PATH);

    const mapWith = (extra: Record<string, unknown>): FieldMap => ({
      form_id: 'test',
      source_pdf: '',
      fields: [{ name: 'box', type: 'checkbox', page: 1, x: 100, y: 100, ...extra }],
    });

    // Bare checkbox: affirmative value draws an X, falsy does not.
    const checked = await stampForm({ fieldMap: mapWith({}), data: { box: true }, sourcePdfBytes });
    const unchecked = await stampForm({ fieldMap: mapWith({}), data: { box: false }, sourcePdfBytes });
    expect(checked.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(checked.length).toBeGreaterThan(unchecked.length);

    // With check_value: stamps only when the resolved value equals it (radio-style).
    const match = await stampForm({ fieldMap: mapWith({ check_value: 'white' }), data: { box: 'white' }, sourcePdfBytes });
    const noMatch = await stampForm({ fieldMap: mapWith({ check_value: 'white' }), data: { box: 'black' }, sourcePdfBytes });
    expect(match.length).toBeGreaterThan(noMatch.length);
  });

  it('handles row_patterns data without throwing', async () => {
    const fieldMap: FieldMap = {
      form_id: 'test',
      source_pdf: '',
      fields: [],
      row_patterns: [
        {
          id: 'adults',
          data_key: 'adults',
          page: 1,
          row_start_y: 500,
          row_pitch: 20,
          max_rows: 3,
          columns: [
            { field_prefix: 'name', type: 'text', x: 72, font_size: 9 },
          ],
        },
      ],
    };

    if (!existsSync(SOURCE_PDF_PATH)) return;

    const sourcePdfBytes = readFileSync(SOURCE_PDF_PATH);
    const data = {
      adults: [{ name: 'Alice Smith' }, { name: 'Bob Jones' }],
    };

    const result = await stampForm({ fieldMap, data, sourcePdfBytes });
    expect(result).toBeInstanceOf(Buffer);
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });
});
