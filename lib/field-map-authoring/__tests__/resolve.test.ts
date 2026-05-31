import { describe, it, expect, beforeAll } from 'vitest';
import type { PDFFont } from 'pdf-lib';
import { loadStamperFont } from '@/lib/field-map-authoring/placement';
import { resolvePlacements, type ResolveSignals } from '@/lib/field-map-authoring/authoring/resolve';
import type { FieldMap } from '@/lib/field-map-authoring/types';

let font: PDFFont;
beforeAll(async () => {
  font = await loadStamperFont();
});

function signals(over: Partial<ResolveSignals>): ResolveSignals {
  return {
    widgets: [],
    printed: [],
    vectors: { verticalRules: [], horizontalRules: [], cells: [] },
    fillTargets: [],
    font,
    ...over,
  };
}

describe('resolvePlacements', () => {
  it('AcroForm: snaps a flat field to its matching widget rectangle', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'applicant_email', type: 'text', page: 1, x: 432, y: 776, font_size: 9, label: 'Email Address' }],
    };
    const sig = signals({
      widgets: [{ page: 1, name: 'Email Address', type: 'text', x: 409, y: 772, width: 171, height: 14 }],
    });
    const { fieldMap, provenance } = resolvePlacements(map, sig);
    expect(provenance[0].strategy).toBe('acroform');
    expect(fieldMap.fields[0].x).toBeCloseTo(411, 0);
  });

  it('AcroForm: does NOT pair "Address" with the "Email Address" widget (exact match only)', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'address_street', type: 'text', page: 1, x: 75, y: 737, font_size: 9, label: 'Address' }],
    };
    const sig = signals({
      widgets: [
        { page: 1, name: 'Email Address', type: 'text', x: 409, y: 772, width: 171, height: 14 },
        { page: 1, name: 'Address', type: 'text', x: 60, y: 734, width: 331, height: 14 },
      ],
    });
    const { fieldMap } = resolvePlacements(map, sig);
    expect(fieldMap.fields[0].x).toBeCloseTo(62, 0); // the real Address widget, not Email
  });

  it('Geometry: snaps a misaligned table column into its header cell', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [],
      row_patterns: [
        {
          id: 'people',
          page: 1,
          data_key: 'rows',
          max_rows: 4,
          row_start_y: 480,
          row_pitch: 20,
          columns: [{ field_prefix: 'age', type: 'text', x: 150, label: 'Age', font_size: 9 }],
        },
      ],
    };
    const sig = signals({
      vectors: {
        verticalRules: [100, 200, 300, 400].map((x) => ({ page: 1, x, yTop: 520, yBottom: 400 })),
        horizontalRules: [],
        cells: [],
      },
      printed: [{ page: 1, str: 'Age', x: 330, y: 500, width: 20, height: 9, cls: 'real_label' }],
    });
    const { fieldMap, provenance } = resolvePlacements(map, sig);
    expect(provenance.find((p) => p.strategy === 'geometry')).toBeTruthy();
    // Age header is at x=330 inside cell [300-400]; the column aligns under the
    // header's left edge (so sibling sub-columns don't collapse), clamped in-cell.
    expect(fieldMap.row_patterns![0].columns[0].x).toBeCloseTo(330, 0);
  });

  it('rejects an implausibly large flat-field move (mismatch guard) → keeps original', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'phone', type: 'text', page: 1, x: 455, y: 704, font_size: 9, label: 'Phone' }],
    };
    const sig = signals({
      // A "Phone" label far away (top of page) — moving there would be > MAX_FLAT_MOVE.
      printed: [{ page: 1, str: 'Phone', x: 20, y: 980, width: 30, height: 9, cls: 'real_label' }],
      fillTargets: [{ page: 1, kind: 'underscore', x: 55, y: 980, width: 100, height: 9 }],
    });
    const { fieldMap, provenance } = resolvePlacements(map, sig);
    expect(provenance[0].strategy).toBe('kept');
    expect(fieldMap.fields[0].x).toBe(455);
  });
});
