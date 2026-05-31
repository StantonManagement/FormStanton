/**
 * lib/field-map-authoring/authoring/resolve.ts
 *
 * Multi-strategy placement resolver — the authoring half of the system. It takes
 * a field map (whose names/labels/table-headers already encode INTENT) plus the
 * source PDF's signals, and recomputes each field/column's coordinates from the
 * STRONGEST available signal, freezing the result into the existing FieldMap
 * shape (so the stamper and the production route are unchanged):
 *
 *   1. AcroForm — a widget whose name matches the field → use the author-defined
 *      rectangle. Exact; overprint/off-page become impossible.
 *   2. Anchor   — a printed label matching the field's label → place the value on
 *      the fill-target (underscore/underline/cell) to its right. Robust to EN/ES
 *      layout drift, because anchors move with labels.
 *   3. Geometry — a table column → snap its x into the cell whose header matches
 *      the column label (fixes "data in the wrong column").
 *   (4. Vision — handled separately in vision.ts for whatever remains unresolved.)
 *
 * Every change is recorded as provenance; nothing is invented — a field with no
 * confident signal is left exactly as-is and reported as `kept`.
 */

import type { PDFFont } from 'pdf-lib';
import type { FieldMap, FlatField, PrintedWord, RowPattern, VerticalRule } from '../types';
import { loadStamperFont } from '../placement';
import { extractPrintedWords } from '../textlayer';
import { extractVectorRegions, type VectorRegions } from '../introspect/vectors';
import { extractWidgets, type Widget } from '../introspect/widgets';
import { extractFillTargets, type FillTarget } from '../introspect/fill-targets';

export type Strategy = 'acroform' | 'anchor' | 'geometry' | 'vision' | 'kept';

export interface Provenance {
  field: string;
  strategy: Strategy;
  from: { x: number; y: number };
  to: { x: number; y: number };
  note?: string;
}

export interface ResolveSignals {
  widgets: Widget[];
  printed: PrintedWord[];
  vectors: VectorRegions;
  fillTargets: FillTarget[];
  font: PDFFont;
}

export interface ResolveResult {
  fieldMap: FieldMap;
  provenance: Provenance[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * A resolved flat-field move larger than this (pts) is treated as a mis-match and
 * rejected: the input maps are roughly right, so a confident signal should place
 * a field NEAR its authored position, not across the page.
 */
const MAX_FLAT_MOVE = 90;
const moveDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Gather every source-PDF signal the resolver needs (one parse pass each). */
export async function gatherSignals(pdfBytes: Uint8Array): Promise<ResolveSignals> {
  const font = await loadStamperFont();
  const [printed, vectors, widgets] = await Promise.all([
    extractPrintedWords(pdfBytes, font),
    extractVectorRegions(pdfBytes),
    extractWidgets(pdfBytes),
  ]);
  return { widgets, printed, vectors, fillTargets: extractFillTargets(printed, vectors), font };
}

// ── Flat-field strategies ───────────────────────────────────────────────────

/**
 * AcroForm: a widget whose normalized name EQUALS the field name or label.
 * Exact-equality only — substring matching wrongly paired "Address" with the
 * "Email Address" widget ("address" ⊂ "emailaddress"). Among exact matches on
 * the page, the one nearest the field's current position wins (disambiguates
 * repeated field names). Returns null when there is no exact match.
 */
function matchWidget(field: FlatField, widgets: Widget[]): Widget | null {
  const keys = new Set([norm(field.name), norm(field.label ?? '')].filter(Boolean));
  let best: Widget | null = null;
  let bestDist = Infinity;
  for (const w of widgets) {
    if (w.page !== (field.page ?? 1)) continue;
    if (w.type !== 'text' && w.type !== 'signature') continue;
    const wn = norm(w.name);
    if (!wn || wn === 'textfield' || !keys.has(wn)) continue;
    const dist = Math.abs(w.x - field.x) + Math.abs(w.y - field.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = w;
    }
  }
  return best;
}

/** Anchor: nearest printed label matching the field's label, then the fill-target to its right. */
function matchAnchorTarget(
  field: FlatField,
  printed: PrintedWord[],
  fillTargets: FillTarget[]
): { target: FillTarget; label: PrintedWord } | null {
  const want = norm(field.label ?? '');
  if (want.length < 3) return null;
  const page = field.page ?? 1;
  // Require the printed label to EQUAL the field label (after normalization), or
  // the field label to be a full prefix of a longer printed label (e.g. map
  // "Address" vs printed "Address:"). No loose substring matching — it paired
  // partial tokens ("Número de") with the wrong text.
  const labels = printed.filter((w) => {
    if (w.page !== page || w.cls !== 'real_label') return false;
    const wn = norm(w.str);
    return wn === want || (wn.startsWith(want) && wn.length - want.length <= 3);
  });
  if (!labels.length) return null;
  // Prefer the label nearest the field's current position (disambiguates repeats).
  labels.sort(
    (a, b) =>
      Math.abs(a.y - field.y) + Math.abs(a.x - field.x) - (Math.abs(b.y - field.y) + Math.abs(b.x - field.x))
  );
  const label = labels[0];
  // Fill target on the same line, to the right of the label, nearest its right
  // edge. Prefer underscore/underline blanks over cells (cells are ambiguous).
  const labelRight = label.x + label.width;
  const candidates = fillTargets
    .filter((t) => t.page === page && Math.abs(t.y - label.y) <= 6 && t.x + t.width > labelRight - 2 && t.x < labelRight + 220)
    .sort((a, b) => {
      const rank = (k: FillTarget['kind']) => (k === 'cell' ? 1 : 0);
      return rank(a.kind) - rank(b.kind) || a.x - b.x;
    });
  if (!candidates.length) return null;
  return { target: candidates[0], label };
}

function baselineFromTarget(t: FillTarget, fontSize: number): { x: number; y: number } {
  if (t.kind === 'cell') return { x: t.x + 3, y: t.y + Math.max(2, (t.height - fontSize) * 0.4) };
  if (t.kind === 'underline') return { x: t.x + 2, y: t.y + 2 };
  return { x: Math.max(t.x, t.x + 2), y: t.y + 1 }; // underscore baseline
}

// ── Table-column strategy (geometry) ──────────────────────────────────────────

function dedupeSorted(xs: number[], eps = 2): number[] {
  const out: number[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) {
    if (!out.length || x - out[out.length - 1] > eps) out.push(x);
  }
  return out;
}

/** Snap a row-pattern's columns into the cells whose headers match their labels. */
function resolveColumns(
  rp: RowPattern,
  printed: PrintedWord[],
  verticalRules: VerticalRule[],
  provenance: Provenance[],
  formId: string
) {
  const page = rp.page ?? 1;
  const topY = rp.row_start_y;
  const botY = rp.row_start_y - rp.row_pitch * (rp.max_rows ?? 9);
  const ruleXs = dedupeSorted(
    verticalRules
      .filter((r) => r.page === page && r.yTop > botY && r.yBottom < topY + rp.row_pitch)
      .map((r) => r.x)
  );
  if (ruleXs.length < 2) return;
  const xMin = ruleXs[0];
  const xMax = ruleXs[ruleXs.length - 1];
  const headers = printed.filter(
    (w) =>
      w.page === page &&
      w.cls === 'real_label' &&
      w.y > topY - 2 &&
      w.y < topY + 70 &&
      w.x + w.width / 2 >= xMin &&
      w.x + w.width / 2 <= xMax
  );
  // Cell [left,right) containing a point, or null if outside the grid.
  const cellFor = (centerX: number): [number, number] | null => {
    for (let i = 0; i < ruleXs.length - 1; i++) {
      if (centerX >= ruleXs[i] && centerX < ruleXs[i + 1]) return [ruleXs[i], ruleXs[i + 1]];
    }
    return null;
  };
  const id = rp.id ?? rp.data_key;
  // Match each column to a header first. Only reposition a column when its header
  // match is UNIQUE among the pattern's columns — otherwise several sub-columns
  // sharing a label (e.g. three "Status N" checkboxes all matching one "Status"
  // header) would collapse onto the same x. Ambiguous matches keep their authored
  // position (the original map already spread them).
  const colHdr = new Map<unknown, ReturnType<typeof bestHeader>>();
  const hdrUses = new Map<PrintedWord, number>();
  for (const col of rp.columns) {
    const label = (col.label ?? '').trim();
    const hdr = label ? bestHeader(label, col.x, headers) : null;
    colHdr.set(col, hdr);
    if (hdr) hdrUses.set(hdr, (hdrUses.get(hdr) ?? 0) + 1);
  }
  for (const col of rp.columns) {
    const label = (col.label ?? '').trim();
    if (!label) continue;
    const hdr = colHdr.get(col);
    if (!hdr || (hdrUses.get(hdr) ?? 0) > 1) continue; // ambiguous → keep authored x
    const cell = cellFor(hdr.x + hdr.width / 2);
    if (!cell) continue;
    const [cellLeft, cellRight] = cell;
    // Align the value under its HEADER's left edge (not the cell's left edge), so
    // multiple sub-columns sharing one un-ruled cell (Last/First/MI) keep their
    // distinct positions instead of collapsing onto each other. Clamp inside the
    // cell so it never crosses a rule.
    const newX = Math.min(Math.max(hdr.x, cellLeft + 1), cellRight - 4);
    if (Math.abs(newX - col.x) < 1) continue;
    provenance.push({
      field: `${id}.${col.field_prefix ?? col.member_key ?? label}`,
      strategy: 'geometry',
      from: { x: col.x, y: rp.row_start_y },
      to: { x: newX, y: rp.row_start_y },
      note: `aligned under header "${hdr.str.trim()}"`,
    });
    col.x = newX;
  }

  // Width-fit pass: after repositioning, set each TEXT column's nominal width to
  // the gap to its next neighbour (or the table's right edge). The stamper
  // ignores width for text, but the geometric overlap check uses it — fitting it
  // keeps declared boxes honest and non-overlapping at the new spacing.
  const sorted = [...rp.columns].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].type !== 'text') continue;
    const right = i + 1 < sorted.length ? sorted[i + 1].x : ruleXs[ruleXs.length - 1];
    const w = Math.round(right - sorted[i].x - 2);
    if (w >= 6) sorted[i].width = w;
  }
}

function bestHeader(label: string, colX: number, headers: PrintedWord[]): PrintedWord | null {
  const ltoks = norm(label).match(/[a-z0-9]+/g)?.filter((t) => t.length >= 3) ?? [norm(label)];
  let best: PrintedWord | null = null;
  let bestScore = 0;
  let bestDist = Infinity;
  for (const h of headers) {
    const ht = norm(h.str);
    if (!ht) continue;
    let score = 0;
    for (const t of ltoks) if (ht === t || ht.includes(t) || t.includes(ht)) score = Math.max(score, Math.min(t.length, ht.length));
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

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Resolve placements for a field map against source-PDF signals. Returns a NEW
 * map (input not mutated) with coordinates recomputed where a confident signal
 * exists, plus per-field provenance. Flat fields try AcroForm then anchor; table
 * columns use cell geometry. Anything unresolved is kept verbatim.
 */
export function resolvePlacements(inputMap: FieldMap, signals: ResolveSignals): ResolveResult {
  const fieldMap: FieldMap = JSON.parse(JSON.stringify(inputMap));
  const provenance: Provenance[] = [];
  const { widgets, printed, vectors, fillTargets } = signals;

  for (const field of fieldMap.fields ?? []) {
    if (field.type !== 'text') continue;
    const from = { x: field.x, y: field.y };
    const fontSize = field.font_size ?? 11;

    const widget = matchWidget(field, widgets);
    if (widget) {
      const to = { x: widget.x + 2, y: widget.y + Math.max(2, (widget.height - fontSize) * 0.4) };
      if (moveDist(from, to) <= MAX_FLAT_MOVE) {
        if (Math.abs(to.x - field.x) >= 1 || Math.abs(to.y - field.y) >= 1) {
          field.x = to.x;
          field.y = to.y;
          provenance.push({ field: field.name, strategy: 'acroform', from, to, note: `widget "${widget.name}"` });
        }
        continue;
      }
    }

    const anchor = matchAnchorTarget(field, printed, fillTargets);
    if (anchor) {
      const to = baselineFromTarget(anchor.target, fontSize);
      if (moveDist(from, to) <= MAX_FLAT_MOVE) {
        if (Math.abs(to.x - field.x) >= 1 || Math.abs(to.y - field.y) >= 1) {
          field.x = to.x;
          field.y = to.y;
          provenance.push({ field: field.name, strategy: 'anchor', from, to, note: `label "${anchor.label.str.trim()}" → ${anchor.target.kind}` });
        }
        continue;
      }
    }

    provenance.push({ field: field.name, strategy: 'kept', from, to: from });
  }

  const patterns = [
    ...(Array.isArray(fieldMap.row_patterns) ? fieldMap.row_patterns : []),
    ...(fieldMap.row_pattern ? [fieldMap.row_pattern] : []),
  ];
  for (const rp of patterns) {
    resolveColumns(rp, printed, vectors.verticalRules, provenance, fieldMap.form_id);
  }

  return { fieldMap, provenance };
}
