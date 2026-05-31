/**
 * lib/field-map-authoring/textlayer.ts
 *
 * PRD-86 — printed-word extractor for VALIDATION (distinct from propose.ts, which
 * extracts text only to scaffold new maps). Returns printed words with bounding
 * boxes in pdf-lib space (origin bottom-left, y = baseline), classified as a
 * `fill_line` (underscores/dots — values BELONG on it) or a `real_label`
 * (label glyphs — a value must NOT overprint these).
 *
 * Why decomposition matters: pdfjs frequently emits a label and its blank line as
 * ONE text item, e.g. "Name: __________________". Treating the whole item as a
 * label would flag every correctly-placed value (which sits on the underscores)
 * as an overprint. So each item is split into label runs vs fill runs, and each
 * run's sub-box x/width is derived from Helvetica metrics (the stamper's font),
 * which closely match the forms' label fonts — accurate enough that real
 * overprints flag and 1–2pt clearances do not.
 */

import type { PDFFont } from 'pdf-lib';
import { type PrintedWord, type PrintedWordClass, FILL_LINE_RE } from './types';
import { safeTextWidth } from './placement';

/** Maximal fill runs inside an item: 2+ underscores, 4+ dots, or 2+ dashes. */
const FILL_RUN_RE = /(_{2,}|\.{4,}|[–—]{2,})/g;

/**
 * Classify a printed token. A token with any Unicode letter or number is a
 * `real_label`; a token that is only fill characters (or empty) is a `fill_line`.
 */
export function classifyWord(str: string): PrintedWordClass {
  const t = str.trim();
  if (!t) return 'fill_line';
  if (/[\p{L}\p{N}]/u.test(t) && !FILL_LINE_RE.test(t)) return 'real_label';
  return 'fill_line';
}

/**
 * Split one text item into label/fill sub-words, positioning each run by its
 * Helvetica-metric offset within the item. Requires a font for metrics; without
 * one, the whole item is emitted as a single classified word (coarse fallback).
 */
function decomposeItem(
  page: number,
  str: string,
  x: number,
  y: number,
  itemWidth: number,
  itemHeight: number,
  font?: PDFFont
): PrintedWord[] {
  const size = itemHeight > 0 ? itemHeight : 10;
  const whole: PrintedWord = { page, str, x, y, width: itemWidth, height: size, cls: classifyWord(str) };

  // Find fill runs (e.g. the underscores in "Inicial: ____ Apellido : ____").
  const re = new RegExp(FILL_RUN_RE.source, 'g');
  const hasFill = re.test(str);
  // No font, or no embedded fill run → use the REAL pdfjs item width (accurate;
  // the form's own font metrics). disableCombineTextItems already separates most
  // labels from their blanks, so this is the common, exact path.
  if (!font || !hasFill) return [whole];

  // Combined label+fill item: allocate the real item width across segments by
  // their Helvetica-metric share (anchored to the true total → robust to the
  // form's actual label font being narrower/wider than Helvetica).
  const totalMetric = safeTextWidth(font, str, size) || 1;
  const out: PrintedWord[] = [];
  let idx = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  const emit = (seg: string, start: number) => {
    if (!seg) return;
    const prefixFrac = safeTextWidth(font, str.slice(0, start), size) / totalMetric;
    const segFrac = safeTextWidth(font, seg, size) / totalMetric;
    out.push({
      page,
      str: seg,
      x: x + prefixFrac * itemWidth,
      y,
      width: segFrac * itemWidth,
      height: size,
      cls: classifyWord(seg),
    });
  };
  while ((m = re.exec(str)) !== null) {
    emit(str.slice(idx, m.index), idx); // label segment before the fill run
    emit(m[0], m.index); // the fill run itself
    idx = m.index + m[0].length;
  }
  emit(str.slice(idx), idx); // trailing segment
  return out.length ? out : [whole];
}

/**
 * Load the pdfjs-dist legacy build, tolerating the `.mjs` (v5+) / `.js` (older)
 * filename difference. The legacy build is the Node-friendly entry and ships no
 * type declarations, so it resolves as `any`.
 */
export async function loadPdfjs(): Promise<any> {
  const candidates = ['pdfjs-dist/legacy/build/pdf.mjs', 'pdfjs-dist/legacy/build/pdf.js'];
  let lastErr: unknown;
  for (const spec of candidates) {
    try {
      return await import(/* @vite-ignore */ spec);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Extract printed words (boxes, classified, decomposed into label/fill runs).
 * pdfjs text items arrive in pdf-lib space (`transform[4]`=x, `transform[5]`=
 * baseline y). `disableCombineTextItems` reduces over-merging; per-item
 * decomposition handles labels+blanks that share a single text-show op.
 *
 * @param font  Helvetica (the stamper's font) for accurate run sub-box widths.
 */
export async function extractPrintedWords(
  pdfBytes: Uint8Array,
  font?: PDFFont
): Promise<PrintedWord[]> {
  const pdfjs: any = await loadPdfjs();
  // pdfjs transfers (detaches) the ArrayBuffer it is given — hand it a COPY so
  // the caller's bytes stay usable for the subsequent pdf-lib render.
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const words: PrintedWord[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent({ disableCombineTextItems: true });
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
      if (!it.str || !it.transform || !it.str.trim()) continue;
      words.push(
        ...decomposeItem(p, it.str, it.transform[4], it.transform[5], it.width ?? 0, it.height ?? 10, font)
      );
    }
  }
  return words;
}
