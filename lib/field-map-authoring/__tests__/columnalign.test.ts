import { describe, it, expect } from 'vitest';
import { findColumnMisalignment } from '@/lib/field-map-authoring/placement';
import type { FieldMap, PrintedWord, VerticalRule } from '@/lib/field-map-authoring/types';

// Cells at x = [100,200,300,400]: cell0 [100-200], cell1 [200-300], cell2 [300-400].
const rules: VerticalRule[] = [100, 200, 300, 400].map((x) => ({ page: 1, x, yTop: 520, yBottom: 400 }));

// Headers printed just above the first row (row_start_y=480): "Student" in cell0,
// "Age" in cell2. A far-left section title also contains the word "age".
const headers: PrintedWord[] = [
  { page: 1, str: 'Student', x: 130, y: 500, width: 40, height: 9, cls: 'real_label' },
  { page: 1, str: 'Age', x: 340, y: 500, width: 20, height: 9, cls: 'real_label' },
  { page: 1, str: 'MINORS UNDER AGE 18', x: 20, y: 505, width: 70, height: 9, cls: 'real_label' },
];

function mapWithAgeAt(x: number): FieldMap {
  return {
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
        columns: [{ field_prefix: 'age', type: 'text', x, label: 'Age', font_size: 9 }],
      },
    ],
  };
}

describe('findColumnMisalignment', () => {
  it('flags a column whose x sits in a different cell than its header', () => {
    const findings = findColumnMisalignment(mapWithAgeAt(150), headers, rules); // age in cell0
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('column_misaligned');
    // proximity tie-break picks the real "Age" header (cell2), not the far title.
    expect(findings[0].reason).toContain('"Age"');
  });

  it('does not flag a column correctly placed under its header', () => {
    expect(findColumnMisalignment(mapWithAgeAt(340), headers, rules)).toEqual([]); // age in cell2
  });

  it('skips assessment when there is no recoverable cell structure', () => {
    expect(findColumnMisalignment(mapWithAgeAt(150), headers, [rules[0]])).toEqual([]);
  });
});
