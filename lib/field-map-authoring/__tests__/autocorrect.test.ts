import { describe, it, expect } from 'vitest';
import { autoCorrectFieldMap } from '@/lib/field-map-authoring/autocorrect';
import { runGeometricValidators, findOutOfBounds } from '@/lib/field-map-authoring/geometric';
import type { FieldMap, PageBox } from '@/lib/field-map-authoring/types';

const LETTER: PageBox[] = [{ page: 1, width: 612, height: 792 }];

describe('autoCorrectFieldMap', () => {
  it('clamps an out-of-bounds flat field back inside the media box', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'a', type: 'text', page: 1, x: 560, y: 100, width: 120, font_size: 11 }],
    };
    const { fieldMap, corrections } = autoCorrectFieldMap(map, LETTER);
    expect(findOutOfBounds(fieldMap, LETTER)).toEqual([]);
    expect(corrections.some((c) => c.kind === 'clamp_in_bounds')).toBe(true);
  });

  it('does not mutate the input map', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'a', type: 'text', page: 1, x: 560, y: 100, width: 120 }],
    };
    autoCorrectFieldMap(map, LETTER);
    expect(map.fields[0].x).toBe(560);
  });

  it('reduces max_rows so a row pattern stops overflowing', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [],
      row_patterns: [
        {
          id: 'members',
          data_key: 'members',
          page: 1,
          row_start_y: 50,
          row_pitch: 20,
          max_rows: 9,
          columns: [{ type: 'text', x: 100, member_key: 'name' }],
        },
      ],
    };
    const { fieldMap, corrections } = autoCorrectFieldMap(map, LETTER);
    expect(fieldMap.row_patterns![0].max_rows).toBe(2); // floor(50/20)
    expect(runGeometricValidators(fieldMap, LETTER)).toEqual([]);
    expect(corrections.some((c) => c.kind === 'reduce_max_rows')).toBe(true);
  });

  it('nudges overlapping flat fields apart', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [
        { name: 'a', type: 'text', page: 1, x: 100, y: 100, width: 80, font_size: 11 },
        { name: 'b', type: 'text', page: 1, x: 105, y: 101, width: 80, font_size: 11 },
      ],
    };
    const { fieldMap, corrections } = autoCorrectFieldMap(map, LETTER);
    expect(runGeometricValidators(fieldMap, LETTER)).toEqual([]);
    expect(corrections.some((c) => c.kind === 'nudge_overlap')).toBe(true);
  });
});
