/**
 * lib/field-map-authoring/introspect/fill-targets.ts
 *
 * Writable-region detection — where on a form a value is MEANT to be written.
 * Combines the text layer (underscore/dot fill runs) with the vector layer
 * (underline rules, table cells) into a single list of candidate targets the
 * anchor/geometry resolver snaps values to. Pure function over already-extracted
 * signals (no PDF I/O). Coordinates are pdf-lib space (bottom-left, y=baseline
 * for text-derived targets, y=line for underline rules).
 */

import type { PrintedWord, CellBox } from '../types';
import type { HorizontalRule, VectorRegions } from './vectors';

export type FillTargetKind = 'underscore' | 'underline' | 'cell';

export interface FillTarget {
  page: number;
  kind: FillTargetKind;
  x: number; // left edge
  y: number; // baseline (underscore) or rule y (underline) or cell bottom (cell)
  width: number;
  height: number;
}

/**
 * Build writable targets from printed fill-line words + vector rules/cells.
 * - underscore: a run of `_`/`.` printed glyphs (value sits on it).
 * - underline:  a horizontal rule with no glyphs (value sits just above it).
 * - cell:       a rectangular box (value sits inside).
 */
export function extractFillTargets(words: PrintedWord[], vectors: VectorRegions): FillTarget[] {
  const targets: FillTarget[] = [];

  for (const w of words) {
    if (w.cls === 'fill_line' && w.width >= 6) {
      targets.push({ page: w.page, kind: 'underscore', x: w.x, y: w.y, width: w.width, height: w.height });
    }
  }
  for (const r of vectors.horizontalRules as HorizontalRule[]) {
    if (r.xRight - r.xLeft >= 12) {
      targets.push({
        page: r.page,
        kind: 'underline',
        x: r.xLeft,
        y: r.y,
        width: r.xRight - r.xLeft,
        height: 0,
      });
    }
  }
  for (const c of vectors.cells as CellBox[]) {
    if (c.width >= 12 && c.height >= 8) {
      targets.push({ page: c.page, kind: 'cell', x: c.x, y: c.y, width: c.width, height: c.height });
    }
  }
  return targets;
}
