/**
 * lib/field-map-authoring/autocorrect.ts
 *
 * PRD-86 Phase A — bounded, deterministic auto-correction of field-map geometry.
 *
 * Auto-correct only makes *bounded* adjustments that the geometric validators can
 * justify: pull out-of-bounds boxes back inside the media box, nudge overlapping
 * boxes apart, and reduce a row pattern's `max_rows` so it stops overflowing the
 * page. It never invents placements or rewrites a map wholesale — anything it
 * cannot safely resolve is left for the human review (PRD-87) to catch.
 *
 * Returns a NEW FieldMap (input is not mutated) plus the list of changes made.
 */

import {
  type FieldMap,
  type FlatField,
  type PageBox,
  type RowPattern,
  TEXT_HEIGHT_FACTOR,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_FLAT_FONT_SIZE,
  DEFAULT_OVERLAP_TOLERANCE,
} from './types';
import { fieldMapToRects, rectsOverlap } from './geometric';

export interface AutoCorrection {
  field: string;
  kind: 'clamp_in_bounds' | 'nudge_overlap' | 'reduce_max_rows';
  detail: string;
}

export interface AutoCorrectResult {
  fieldMap: FieldMap;
  corrections: AutoCorrection[];
}

const MARGIN = 4; // keep a small margin off the page edge when clamping

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/**
 * Correct geometry defects. Order matters: fix row overflow first (changes which
 * row cells exist), then clamp flat fields in-bounds, then de-overlap flat fields.
 */
export function autoCorrectFieldMap(
  input: FieldMap,
  pages: PageBox[],
  tolerance = DEFAULT_OVERLAP_TOLERANCE
): AutoCorrectResult {
  const fieldMap = clone(input);
  const corrections: AutoCorrection[] = [];
  const byPage = new Map(pages.map((p) => [p.page, p]));

  // 1. Reduce max_rows for any row pattern that overflows the page bottom.
  const patterns: RowPattern[] = [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];
  for (const rp of patterns) {
    const declared = rp.max_rows ?? 9;
    if (rp.row_pitch > 0) {
      // largest n with row_start_y − pitch×n ≥ 0
      const fit = Math.floor(rp.row_start_y / rp.row_pitch);
      if (fit < declared) {
        rp.max_rows = Math.max(0, fit);
        corrections.push({
          field: rp.id ?? rp.data_key,
          kind: 'reduce_max_rows',
          detail: `max_rows ${declared} → ${rp.max_rows} to fit above page bottom`,
        });
      }
    }
  }

  // 2. Clamp flat fields that fall outside their media box.
  for (const field of fieldMap.fields ?? []) {
    const box = byPage.get(field.page ?? 1);
    if (!box) continue;
    const fontSize = field.font_size ?? DEFAULT_FLAT_FONT_SIZE;
    const w = field.width ?? DEFAULT_TEXT_WIDTH;
    const h = field.height ?? fontSize * TEXT_HEIGHT_FACTOR;
    const before = { x: field.x, y: field.y };
    const maxX = box.width - w - MARGIN;
    const maxY = box.height - h - MARGIN;
    field.x = Math.min(Math.max(field.x, MARGIN), Math.max(MARGIN, maxX));
    field.y = Math.min(Math.max(field.y, MARGIN), Math.max(MARGIN, maxY));
    if (field.x !== before.x || field.y !== before.y) {
      corrections.push({
        field: field.name,
        kind: 'clamp_in_bounds',
        detail: `(${before.x},${before.y}) → (${field.x.toFixed(0)},${field.y.toFixed(0)})`,
      });
    }
  }

  // 3. Nudge overlapping FLAT fields upward (in reading order) until clear or capped.
  //    Row-pattern cells are not auto-moved (their geometry is structural — pitch).
  const flat = fieldMap.fields ?? [];
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flatFieldsOverlap(flat[i], flat[j], tolerance)) {
        const moved = nudgeApart(flat[j], flat[i], byPage.get(flat[j].page ?? 1));
        if (moved) {
          corrections.push({
            field: flat[j].name,
            kind: 'nudge_overlap',
            detail: `nudged clear of "${flat[i].name}"`,
          });
        }
      }
    }
  }

  return { fieldMap, corrections };
}

function flatFieldsOverlap(a: FlatField, b: FlatField, tolerance: number): boolean {
  const map: FieldMap = { form_id: '_', source_pdf: '_', fields: [a, b] };
  const rects = fieldMapToRects(map);
  return rectsOverlap(rects[0], rects[1], tolerance);
}

/** Move `target` up just past `anchor`'s top edge, if it stays in-bounds. */
function nudgeApart(target: FlatField, anchor: FlatField, box?: PageBox): boolean {
  const anchorFont = anchor.font_size ?? DEFAULT_FLAT_FONT_SIZE;
  const anchorTop = anchor.y + (anchor.height ?? anchorFont * TEXT_HEIGHT_FACTOR);
  const targetFont = target.font_size ?? DEFAULT_FLAT_FONT_SIZE;
  const targetH = target.height ?? targetFont * TEXT_HEIGHT_FACTOR;
  const newY = anchorTop + DEFAULT_OVERLAP_TOLERANCE + 1;
  if (box && newY + targetH + MARGIN > box.height) return false; // can't fit; leave for human
  target.y = newY;
  return true;
}
