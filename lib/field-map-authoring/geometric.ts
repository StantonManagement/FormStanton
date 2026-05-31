/**
 * lib/field-map-authoring/geometric.ts
 *
 * PRD-86 Phase A — rect extraction + geometric validators.
 *
 * Pure functions over a FieldMap and page boxes. No I/O. All coordinates are
 * pdf-lib space (origin bottom-left). A flat text field's drawing anchor is its
 * baseline at (x, y); we model its box as [x, y, width, font_size*factor] going
 * up from the baseline, which is how the stamped glyphs occupy space.
 */

import {
  type FieldMap,
  type PageBox,
  type Rect,
  type ValidationFinding,
  DEFAULT_OVERLAP_TOLERANCE,
  TEXT_HEIGHT_FACTOR,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_FLAT_FONT_SIZE,
  DEFAULT_ROW_FONT_SIZE,
} from './types';

/** Build the list of rects a field map will draw (flat fields + row-pattern cells). */
export function fieldMapToRects(fieldMap: FieldMap): Rect[] {
  const rects: Rect[] = [];

  for (const field of fieldMap.fields ?? []) {
    const fontSize = field.font_size ?? DEFAULT_FLAT_FONT_SIZE;
    rects.push({
      page: field.page ?? 1,
      x: field.x,
      y: field.y,
      width: field.width ?? DEFAULT_TEXT_WIDTH,
      height: field.height ?? fontSize * TEXT_HEIGHT_FACTOR,
      name: field.name,
    });
  }

  const patterns = [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];

  for (const rp of patterns) {
    const id = rp.id ?? rp.data_key;
    const maxRows = rp.max_rows ?? 9;
    // Sorted unique x positions let us infer a widthless text column's width from
    // the gap to the next column — narrow table cells must not be modeled as the
    // wide DEFAULT_TEXT_WIDTH, or adjacent cells/checkboxes register false overlaps.
    const xsAsc = [...new Set(rp.columns.map((c) => c.x))].sort((a, b) => a - b);
    for (let i = 0; i < maxRows; i++) {
      const rowY = rp.row_start_y - i * rp.row_pitch;
      rp.columns.forEach((col, colIdx) => {
        const fontSize = col.font_size ?? DEFAULT_ROW_FONT_SIZE;
        const colKey = col.field_prefix ?? col.member_key ?? 'col';
        rects.push({
          page: rp.page ?? 1,
          x: col.x,
          y: rowY + (col.y_offset ?? 5),
          width: rowColumnWidth(col, xsAsc, fontSize),
          height: col.height ?? fontSize * TEXT_HEIGHT_FACTOR,
          // Column index keeps the name unique even when several columns share a
          // member_key (e.g. one status field rendered as multiple checkboxes).
          name: `${id}[${i}].${colKey}#${colIdx}`,
        });
      });
    }
  }

  return rects;
}

/**
 * Effective width of a row-pattern column for geometric checks:
 *   - explicit `col.width` wins;
 *   - a checkbox is one glyph wide (~font size);
 *   - a widthless text column infers width from the gap to the next column x,
 *     falling back to DEFAULT_TEXT_WIDTH only for the rightmost column.
 */
function rowColumnWidth(
  col: { type: string; x: number; width?: number },
  sortedXs: number[],
  fontSize: number
): number {
  if (typeof col.width === 'number') return col.width;
  if (col.type === 'checkbox') return fontSize;
  const nextX = sortedXs.find((x) => x > col.x);
  if (nextX !== undefined) return Math.max(8, nextX - col.x - 2);
  return DEFAULT_TEXT_WIDTH;
}

/** True when `rect` lies fully within the page media box. */
export function isWithinBox(rect: Rect, box: PageBox): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= box.width &&
    rect.y + rect.height <= box.height
  );
}

/** AABB overlap test with a point tolerance (touching/adjacent within tol → no overlap). */
export function rectsOverlap(a: Rect, b: Rect, tolerance = DEFAULT_OVERLAP_TOLERANCE): boolean {
  if (a.page !== b.page) return false;
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > tolerance && overlapY > tolerance;
}

/** Flag every rect that extends outside its page media box. */
export function findOutOfBounds(fieldMap: FieldMap, pages: PageBox[]): ValidationFinding[] {
  const byPage = new Map(pages.map((p) => [p.page, p]));
  const findings: ValidationFinding[] = [];
  for (const rect of fieldMapToRects(fieldMap)) {
    const box = byPage.get(rect.page);
    if (!box) {
      findings.push({
        kind: 'out_of_bounds',
        formId: fieldMap.form_id,
        field: rect.name,
        page: rect.page,
        box: rect,
        reason: `references page ${rect.page} which does not exist`,
      });
      continue;
    }
    if (!isWithinBox(rect, box)) {
      findings.push({
        kind: 'out_of_bounds',
        formId: fieldMap.form_id,
        field: rect.name,
        page: rect.page,
        box: rect,
        reason: `box [${rect.x.toFixed(0)},${rect.y.toFixed(0)},${rect.width.toFixed(0)}x${rect.height.toFixed(0)}] exceeds page ${box.width}x${box.height}`,
      });
    }
  }
  return findings;
}

/** Flag overlapping rect pairs beyond the tolerance. */
export function findOverlaps(
  fieldMap: FieldMap,
  tolerance = DEFAULT_OVERLAP_TOLERANCE
): ValidationFinding[] {
  const rects = fieldMapToRects(fieldMap);
  const findings: ValidationFinding[] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j], tolerance)) {
        findings.push({
          kind: 'overlap',
          formId: fieldMap.form_id,
          field: rects[i].name,
          page: rects[i].page,
          box: rects[i],
          reason: `overlaps "${rects[j].name}"`,
        });
      }
    }
  }
  return findings;
}

/**
 * Flag row patterns that overflow the bottom of the page:
 * row_start_y − row_pitch × max_rows must stay ≥ 0 (page bottom).
 */
export function findRowOverflows(fieldMap: FieldMap, pages: PageBox[]): ValidationFinding[] {
  void pages; // bottom is 0 in pdf-lib space; pages kept for signature symmetry
  const patterns = [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];
  const findings: ValidationFinding[] = [];
  for (const rp of patterns) {
    const maxRows = rp.max_rows ?? 9;
    const lastRowY = rp.row_start_y - rp.row_pitch * maxRows;
    if (lastRowY < 0) {
      findings.push({
        kind: 'row_overflow',
        formId: fieldMap.form_id,
        field: rp.id ?? rp.data_key,
        page: rp.page ?? 1,
        reason: `row pattern overflows page bottom: start_y ${rp.row_start_y} − pitch ${rp.row_pitch} × ${maxRows} rows = ${lastRowY.toFixed(0)} (< 0)`,
      });
    }
  }
  return findings;
}

/** Run all geometric validators. */
export function runGeometricValidators(
  fieldMap: FieldMap,
  pages: PageBox[],
  tolerance = DEFAULT_OVERLAP_TOLERANCE
): ValidationFinding[] {
  return [
    ...findOutOfBounds(fieldMap, pages),
    ...findOverlaps(fieldMap, tolerance),
    ...findRowOverflows(fieldMap, pages),
  ];
}
