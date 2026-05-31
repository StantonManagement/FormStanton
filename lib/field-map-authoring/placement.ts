/**
 * lib/field-map-authoring/placement.ts
 *
 * PRD-86 — deterministic, rasterization-free placement validators.
 *
 * The insight: the production stamper embeds a single StandardFonts.Helvetica
 * (stamper.ts) and draws text with `page.drawText({x, y, size, font})`, IGNORING
 * the declared `width`. So a value's TRUE rendered box can be reproduced exactly
 * with `font.widthOfTextAtSize(value, size)` — no rasterizer needed. We compute
 * each stamped value's real box from the sample data and check it against:
 *
 *   findOffPageText — the box's right edge runs past the page width.
 *   findOverprints  — the box overlaps a PRINTED label (not a fill-line) on the
 *                     source PDF; this also catches the EN/ES "wrong line" class,
 *                     where a value lands on the label row above and overlaps it.
 *
 * These replace the OCR round-trip as the real safety net wherever rasterization
 * is unavailable. They require representative sample data (worst-case lengths).
 */

import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import {
  type FieldMap,
  type PageBox,
  type PrintedWord,
  type Rect,
  type RowPattern,
  type ValidationFinding,
  type VerticalRule,
  TEXT_HEIGHT_FACTOR,
  DEFAULT_FLAT_FONT_SIZE,
  DEFAULT_ROW_FONT_SIZE,
  OVERPRINT_TOLERANCE,
  COLUMN_MISALIGN_TOLERANCE,
} from './types';
import { rectsOverlap } from './geometric';

/**
 * Embed the SAME StandardFont the stamper embeds (stamper.ts:72). Metric widths
 * from this font reproduce the stamper's exact glyph advance. If the stamper ever
 * switches fonts, this must change in lockstep — keep them referencing one font.
 */
export const STAMPER_STANDARD_FONT = StandardFonts.Helvetica;

export async function loadStamperFont(): Promise<PDFFont> {
  const doc = await PDFDocument.create();
  return doc.embedFont(STAMPER_STANDARD_FONT);
}

/**
 * Width of text in the stamper font, tolerating glyphs WinAnsi/Helvetica cannot
 * encode (bullets, ☐, non-breaking hyphen, etc. that appear in source labels).
 * Non-encodable chars are replaced with a space so measurement never throws —
 * accurate enough for run positioning and overprint geometry.
 */
export function safeTextWidth(font: PDFFont, text: string, size: number): number {
  const safe = text.replace(/[^\x20-\x7E -ÿ]/g, ' ');
  try {
    return font.widthOfTextAtSize(safe, size);
  } catch {
    return safe.length * size * 0.5; // last-resort approximation
  }
}

/** A stamped value's true rendered box (width from font metrics), with its value. */
export interface ValueBox extends Rect {
  value: string;
}

/**
 * Reproduce, box-for-box, what the stamper will draw — walking the same fields
 * and row patterns in the same order, computing each text box's width from font
 * metrics. Empty/undefined values and image fields are skipped (nothing drawn).
 * Checkbox cells render a single 'X' only when the value equals `check_value`.
 */
export function valueBoxesFromMap(
  fieldMap: FieldMap,
  data: Record<string, unknown>,
  font: PDFFont
): ValueBox[] {
  const boxes: ValueBox[] = [];

  const textBox = (
    page: number,
    name: string,
    x: number,
    yBaseline: number,
    size: number,
    value: string
  ) => {
    boxes.push({
      page,
      x,
      y: yBaseline,
      width: safeTextWidth(font, value, size),
      height: size * TEXT_HEIGHT_FACTOR,
      name,
      value,
    });
  };

  // Flat fields (text only — images draw a picture, not measurable text).
  for (const f of fieldMap.fields ?? []) {
    if (f.type !== 'text') continue;
    const value = data[f.name];
    if (value === undefined || value === null || value === '') continue;
    const str = String(value);
    if (!str.trim()) continue;
    textBox(f.page ?? 1, f.name, f.x, f.y, f.font_size ?? DEFAULT_FLAT_FONT_SIZE, str);
  }

  // Row patterns (plural + legacy singular), matching stamper.ts row math:
  // baseline y = row_start_y - i*row_pitch + (col.y_offset ?? 5).
  const patterns = [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];
  for (const rp of patterns) {
    const rows = data[rp.data_key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const id = rp.id ?? rp.data_key;
    const maxRows = rp.max_rows ?? 9;
    for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
      const row = rows[i] as Record<string, unknown>;
      const rowY = rp.row_start_y - i * rp.row_pitch;
      for (const col of rp.columns) {
        const key = col.field_prefix ?? col.member_key ?? '';
        const value = row[key];
        if (value === undefined || value === null || value === '') continue;
        const size = col.font_size ?? DEFAULT_ROW_FONT_SIZE;
        const yPos = rowY + (col.y_offset ?? 5);
        const name = `${id}[${i}].${key}`;
        if (col.type === 'text') {
          const str = String(value);
          if (!str.trim()) continue;
          textBox(rp.page ?? 1, name, col.x, yPos, size, str);
        } else if (col.type === 'checkbox') {
          // Stamper draws 'X' only when the value matches check_value.
          if (String(value) === String(col.check_value)) {
            textBox(rp.page ?? 1, name, col.x, yPos, size, 'X');
          }
        }
      }
    }
  }

  return boxes;
}

/** A value whose true rendered right edge runs past the page width → 'offpage_text'. */
export function findOffPageText(
  fieldMap: FieldMap,
  data: Record<string, unknown>,
  pages: PageBox[],
  font: PDFFont
): ValidationFinding[] {
  const byPage = new Map(pages.map((p) => [p.page, p]));
  const findings: ValidationFinding[] = [];
  for (const box of valueBoxesFromMap(fieldMap, data, font)) {
    const page = byPage.get(box.page);
    if (!page) continue; // missing-page handled by findOutOfBounds
    const right = box.x + box.width;
    if (right > page.width + 0.5) {
      findings.push({
        kind: 'offpage_text',
        formId: fieldMap.form_id,
        field: box.name,
        page: box.page,
        box,
        reason: `value "${box.value}" renders to x=${right.toFixed(0)} (text width ${box.width.toFixed(0)}) but page width is ${page.width.toFixed(0)} — the stamper ignores the declared box width`,
      });
    }
  }
  return findings;
}

/** A value box overlapping a PRINTED real-label (fill-lines excluded) → 'overprint'. */
export function findOverprints(
  fieldMap: FieldMap,
  data: Record<string, unknown>,
  printed: PrintedWord[],
  font: PDFFont,
  tolerance = OVERPRINT_TOLERANCE
): ValidationFinding[] {
  const labels = printed.filter((w) => w.cls === 'real_label');
  const labelRects: Rect[] = labels.map((w) => ({
    page: w.page,
    x: w.x,
    y: w.y,
    width: w.width,
    height: w.height,
    name: w.str,
  }));
  const findings: ValidationFinding[] = [];
  for (const box of valueBoxesFromMap(fieldMap, data, font)) {
    for (let k = 0; k < labelRects.length; k++) {
      if (rectsOverlap(box, labelRects[k], tolerance)) {
        const label = labels[k];
        findings.push({
          kind: 'overprint',
          formId: fieldMap.form_id,
          field: box.name,
          page: box.page,
          box,
          reason: `value "${box.value}" overlaps printed label "${label.str.trim()}" at (${label.x.toFixed(0)},${label.y.toFixed(0)})`,
        });
        break; // one finding per value; first overlapping label is enough
      }
    }
  }
  return findings;
}

// ── Column-vs-cell alignment (the "wrong column" defect class) ──────────────────

function allPatterns(fieldMap: FieldMap): RowPattern[] {
  return [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Dedupe near-equal numbers (rule x-positions drawn twice) within `eps`. */
function dedupeSorted(xs: number[], eps = 2): number[] {
  const out: number[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) {
    if (!out.length || x - out[out.length - 1] > eps) out.push(x);
  }
  return out;
}

/**
 * Best header word matching a column label, by longest shared token, tie-broken
 * by x-proximity to the column. The tie-break is what disambiguates a real
 * column header ("Age") from an incidental section title that shares the word
 * ("*MINORS (UNDER THE AGE OF 18)*") — the header sits nearer the column's x.
 */
function bestHeaderMatch(label: string, colX: number, headers: PrintedWord[]): PrintedWord | null {
  const ltoks = norm(label)
    .match(/[a-z0-9]+/g)
    ?.filter((t) => t.length >= 3) ?? [norm(label)];
  let best: PrintedWord | null = null;
  let bestScore = 0;
  let bestDist = Infinity;
  for (const h of headers) {
    const ht = norm(h.str);
    if (!ht) continue;
    let score = 0;
    for (const t of ltoks) {
      if (ht === t || ht.includes(t) || t.includes(ht)) score = Math.max(score, Math.min(t.length, ht.length));
    }
    if (score === 0) continue;
    const dist = Math.abs(h.x + h.width / 2 - colX);
    if (score > bestScore || (score === bestScore && dist < bestDist)) {
      bestScore = score;
      bestDist = dist;
      best = h;
    }
  }
  return best;
}

/**
 * Flag a table column whose x lands in a DIFFERENT cell than its header — the
 * "data under the wrong column" defect (e.g. age rendered under the Student
 * column). Cells come from the vector layer's vertical rules; the header band is
 * the real-label words just above the first row. A column is flagged when the
 * cell containing its x differs from the cell containing its matched header.
 * Needs both vertical rules and a column `label`; skips assessment otherwise.
 */
export function findColumnMisalignment(
  fieldMap: FieldMap,
  printed: PrintedWord[],
  verticalRules: VerticalRule[],
  tol = COLUMN_MISALIGN_TOLERANCE
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  for (const rp of allPatterns(fieldMap)) {
    const page = rp.page ?? 1;
    const topY = rp.row_start_y;
    const botY = rp.row_start_y - rp.row_pitch * (rp.max_rows ?? 9);
    const ruleXs = dedupeSorted(
      verticalRules
        .filter((r) => r.page === page && r.yTop > botY && r.yBottom < topY + rp.row_pitch)
        .map((r) => r.x)
    );
    if (ruleXs.length < 2) continue; // no recoverable cell structure
    // Strict interior bounds (no inter-cell overlap); `tol` only slackens the
    // outermost edges so a value flush to the first/last rule still classifies.
    const cellOf = (x: number): number => {
      if (x < ruleXs[0] - tol || x > ruleXs[ruleXs.length - 1] + tol) return -1;
      for (let i = 0; i < ruleXs.length - 1; i++) {
        if (x >= ruleXs[i] && x < ruleXs[i + 1]) return i;
      }
      return ruleXs.length - 2; // flush to the last rule → last cell
    };
    // Header band: real labels printed just above the first data row, and within
    // the table's horizontal extent (a column header sits inside the table; stray
    // section titles outside the rule span are not column headers).
    const xMin = ruleXs[0] - tol;
    const xMax = ruleXs[ruleXs.length - 1] + tol;
    const headers = printed.filter(
      (w) =>
        w.page === page &&
        w.cls === 'real_label' &&
        w.y > topY - 2 &&
        w.y < topY + 70 &&
        w.x + w.width / 2 >= xMin &&
        w.x + w.width / 2 <= xMax
    );
    const id = rp.id ?? rp.data_key;
    // Match each column to a header, then count header uses. Sub-columns that
    // share a label (e.g. three "Status N" checkboxes all matching the one
    // "Status" word) match the SAME header ambiguously — the detector cannot tell
    // which sub-position is right, so it must not flag them (they're spread under
    // short "1/2/3" sub-headers the matcher can't bind to). Only assess columns
    // whose header match is unique.
    const colHdr = new Map<unknown, PrintedWord | null>();
    const hdrUses = new Map<PrintedWord, number>();
    for (const col of rp.columns) {
      const label = (col.label ?? '').trim();
      const hdr = label ? bestHeaderMatch(label, col.x, headers) : null;
      colHdr.set(col, hdr);
      if (hdr) hdrUses.set(hdr, (hdrUses.get(hdr) ?? 0) + 1);
    }
    for (const col of rp.columns) {
      const label = (col.label ?? '').trim();
      if (!label) continue;
      const hdr = colHdr.get(col);
      if (!hdr || (hdrUses.get(hdr) ?? 0) > 1) continue; // ambiguous → cannot assess
      const colCell = cellOf(col.x);
      const hdrCell = cellOf(hdr.x + hdr.width / 2);
      if (colCell === -1 || hdrCell === -1 || colCell === hdrCell) continue;
      const key = col.field_prefix ?? col.member_key ?? label;
      findings.push({
        kind: 'column_misaligned',
        formId: fieldMap.form_id,
        field: `${id}.${key}`,
        page,
        reason: `column "${label}" at x=${col.x} renders in cell ${colCell} [${ruleXs[colCell].toFixed(0)}–${ruleXs[colCell + 1].toFixed(0)}] but its header "${hdr.str.trim()}" is in cell ${hdrCell} [${ruleXs[hdrCell].toFixed(0)}–${ruleXs[hdrCell + 1].toFixed(0)}]`,
      });
    }
  }
  return findings;
}

/**
 * Flag two stamped values whose boxes overlap EACH OTHER — e.g. table sub-columns
 * (Last/First/MI) collapsed onto the same x, or a value overflowing into its
 * neighbour. A defect the field-vs-field geometric check misses because it uses
 * declared widths (often 0 for same-x columns); here we use true metric widths.
 */
export function findValueCollisions(
  fieldMap: FieldMap,
  data: Record<string, unknown>,
  font: PDFFont,
  tolerance = OVERPRINT_TOLERANCE
): ValidationFinding[] {
  const boxes = valueBoxesFromMap(fieldMap, data, font);
  const findings: ValidationFinding[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (rectsOverlap(boxes[i], boxes[j], tolerance)) {
        findings.push({
          kind: 'value_collision',
          formId: fieldMap.form_id,
          field: boxes[i].name,
          page: boxes[i].page,
          box: boxes[i],
          reason: `value "${boxes[i].value}" overlaps value "${boxes[j].value}" ("${boxes[j].name}")`,
        });
      }
    }
  }
  return findings;
}

export interface PlacementOptions {
  overprintTolerance?: number;
  /** Vertical rules from the vector layer; enables column-misalignment checks. */
  verticalRules?: VerticalRule[];
  columnTolerance?: number;
}

/**
 * Run the rasterization-free placement validators. Requires representative sample
 * data; with none, callers skip it (the boxes would be empty anyway).
 * Column-misalignment (needs the vector/header layer) is added in a later phase.
 */
export function runPlacementValidators(
  fieldMap: FieldMap,
  data: Record<string, unknown>,
  pages: PageBox[],
  printed: PrintedWord[],
  font: PDFFont,
  opts: PlacementOptions = {}
): ValidationFinding[] {
  return [
    ...findOffPageText(fieldMap, data, pages, font),
    ...findOverprints(fieldMap, data, printed, font, opts.overprintTolerance),
    ...findValueCollisions(fieldMap, data, font, opts.overprintTolerance),
    ...(opts.verticalRules
      ? findColumnMisalignment(fieldMap, printed, opts.verticalRules, opts.columnTolerance)
      : []),
  ];
}
