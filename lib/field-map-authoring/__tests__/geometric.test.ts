import { describe, it, expect } from 'vitest';
import {
  findOverlaps,
  findOutOfBounds,
  findRowOverflows,
  runGeometricValidators,
} from '@/lib/field-map-authoring/geometric';
import type { FieldMap, PageBox } from '@/lib/field-map-authoring/types';

const LETTER: PageBox[] = [{ page: 1, width: 612, height: 792 }];

describe('findOverlaps', () => {
  it('flags two flat fields that occupy the same area', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [
        { name: 'a', type: 'text', page: 1, x: 100, y: 100, width: 80, font_size: 11 },
        { name: 'b', type: 'text', page: 1, x: 110, y: 102, width: 80, font_size: 11 },
      ],
    };
    const findings = findOverlaps(map);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].kind).toBe('overlap');
  });

  it('does not flag well-separated fields', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [
        { name: 'a', type: 'text', page: 1, x: 100, y: 100, width: 80, font_size: 11 },
        { name: 'b', type: 'text', page: 1, x: 100, y: 300, width: 80, font_size: 11 },
      ],
    };
    expect(findOverlaps(map)).toEqual([]);
  });
});

describe('findOutOfBounds', () => {
  it('flags a box that runs past the page edge', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'a', type: 'text', page: 1, x: 560, y: 100, width: 120, font_size: 11 }],
    };
    const findings = findOutOfBounds(map, LETTER);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('out_of_bounds');
  });

  it('flags a reference to a non-existent page', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'a', type: 'text', page: 3, x: 100, y: 100, width: 80 }],
    };
    expect(findOutOfBounds(map, LETTER)).toHaveLength(1);
  });

  it('passes a box fully inside the media box', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'a', type: 'text', page: 1, x: 100, y: 100, width: 80, font_size: 11 }],
    };
    expect(findOutOfBounds(map, LETTER)).toEqual([]);
  });
});

describe('findRowOverflows', () => {
  it('flags a row pattern that overflows the page bottom', () => {
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
    const findings = findRowOverflows(map, LETTER);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('row_overflow');
  });

  it('passes a row pattern that fits', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [],
      row_patterns: [
        {
          id: 'members',
          data_key: 'members',
          page: 1,
          row_start_y: 700,
          row_pitch: 20,
          max_rows: 9,
          columns: [{ type: 'text', x: 100, member_key: 'name' }],
        },
      ],
    };
    expect(findRowOverflows(map, LETTER)).toEqual([]);
  });
});

describe('runGeometricValidators', () => {
  it('returns no findings for a clean map', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [
        { name: 'a', type: 'text', page: 1, x: 72, y: 700, width: 200, font_size: 11 },
        { name: 'b', type: 'text', page: 1, x: 72, y: 650, width: 200, font_size: 11 },
      ],
    };
    expect(runGeometricValidators(map, LETTER)).toEqual([]);
  });
});
