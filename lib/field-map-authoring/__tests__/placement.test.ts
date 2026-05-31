import { describe, it, expect, beforeAll } from 'vitest';
import type { PDFFont } from 'pdf-lib';
import {
  loadStamperFont,
  valueBoxesFromMap,
  findOffPageText,
  findOverprints,
} from '@/lib/field-map-authoring/placement';
import type { FieldMap, PageBox, PrintedWord } from '@/lib/field-map-authoring/types';

const LETTER: PageBox[] = [{ page: 1, width: 612, height: 792 }];

let font: PDFFont;
beforeAll(async () => {
  font = await loadStamperFont(); // real Helvetica metrics, no rasterization
});

describe('findOffPageText (uses TRUE rendered width, not declared width)', () => {
  it('flags a long value whose metric width runs past the page edge', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      // Declared width is a harmless 40 — but the stamper ignores it and draws the
      // full string, which overflows from x=560.
      fields: [
        { name: 'email', type: 'text', page: 1, x: 560, y: 100, width: 40, font_size: 11 },
      ],
    };
    const findings = findOffPageText(map, { email: 'really.long.address@example.com' }, LETTER, font);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('offpage_text');
  });

  it('does not flag a short value that fits', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [{ name: 'zip', type: 'text', page: 1, x: 560, y: 100, width: 40, font_size: 11 }],
    };
    expect(findOffPageText(map, { zip: '06105' }, LETTER, font)).toEqual([]);
  });
});

describe('findOverprints', () => {
  const map: FieldMap = {
    form_id: 'f',
    source_pdf: 's',
    fields: [{ name: 'dob', type: 'text', page: 1, x: 200, y: 400, width: 100, font_size: 9 }],
  };

  it('flags a value drawn on top of a printed label', () => {
    const printed: PrintedWord[] = [
      { page: 1, str: 'nacimiento:', x: 195, y: 398, width: 60, height: 9, cls: 'real_label' },
    ];
    const findings = findOverprints(map, { dob: '4/12/1990' }, printed, font);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('overprint');
    expect(findings[0].reason).toContain('nacimiento');
  });

  it('does NOT flag a value sitting on a fill-line (that is where values belong)', () => {
    const printed: PrintedWord[] = [
      { page: 1, str: '__________', x: 195, y: 398, width: 120, height: 9, cls: 'fill_line' },
    ];
    expect(findOverprints(map, { dob: '4/12/1990' }, printed, font)).toEqual([]);
  });

  it('catches the EN/ES wrong-line class: a value lifted onto the label row above', () => {
    // ES bug shape: the value baseline (y) was copied from EN and sits ~14pt too
    // high, landing on the label printed on the row above and overlapping it.
    const esMap: FieldMap = {
      form_id: 'main-application-es',
      source_pdf: 's',
      fields: [{ name: 'phone_home', type: 'text', page: 1, x: 148, y: 756, width: 120, font_size: 9 }],
    };
    const printed: PrintedWord[] = [
      { page: 1, str: 'Nombre:', x: 18, y: 757, width: 40, height: 9, cls: 'real_label' },
      { page: 1, str: 'Casa:', x: 120, y: 757, width: 32, height: 9, cls: 'real_label' },
    ];
    const findings = findOverprints(esMap, { phone_home: '860-555-0100' }, printed, font);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].kind).toBe('overprint');
  });

  it('flags a checkbox X that lands on a label', () => {
    const cbMap: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [],
      row_patterns: [
        {
          id: 'status',
          page: 1,
          data_key: 'rows',
          max_rows: 3,
          row_start_y: 400,
          row_pitch: 20,
          columns: [
            { member_key: 'citizen', type: 'checkbox', x: 300, y_offset: 5, check_value: 'yes', font_size: 9 },
          ],
        },
      ],
    };
    const printed: PrintedWord[] = [
      { page: 1, str: 'Status', x: 298, y: 404, width: 30, height: 9, cls: 'real_label' },
    ];
    const findings = findOverprints(cbMap, { rows: [{ citizen: 'yes' }] }, printed, font);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('overprint');
  });
});

describe('valueBoxesFromMap', () => {
  it('skips empty values and unchecked checkboxes; measures real widths', () => {
    const map: FieldMap = {
      form_id: 'f',
      source_pdf: 's',
      fields: [
        { name: 'a', type: 'text', page: 1, x: 10, y: 10, width: 100, font_size: 12 },
        { name: 'b', type: 'text', page: 1, x: 10, y: 30, width: 100, font_size: 12 },
      ],
      row_patterns: [
        {
          id: 'r',
          page: 1,
          data_key: 'rows',
          max_rows: 5,
          row_start_y: 200,
          row_pitch: 20,
          columns: [{ member_key: 'flag', type: 'checkbox', x: 50, check_value: 'on', font_size: 9 }],
        },
      ],
    };
    const boxes = valueBoxesFromMap(
      map,
      { a: 'hello', b: '', rows: [{ flag: 'off' }, { flag: 'on' }] },
      font
    );
    // 'a' rendered, 'b' empty (skipped), one checked checkbox (row 2) → 2 boxes.
    expect(boxes.map((b) => b.name).sort()).toEqual(['a', 'r[1].flag']);
    expect(boxes.find((b) => b.name === 'a')!.width).toBeGreaterThan(0);
  });
});
