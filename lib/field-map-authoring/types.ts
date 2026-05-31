/**
 * lib/field-map-authoring/types.ts
 *
 * PRD-86 Phase A — shared types for the field-map authoring/preview/validate tool.
 *
 * The OUTPUT contract is the `stamper.ts` `FieldMap` shape, imported here — the tool
 * emits exactly that, nothing else. All geometry is in pdf-lib coordinate space
 * (origin bottom-left, y increases upward), the same space `stampForm` renders in.
 */

import type { FieldMap, FlatField, RowPattern, FieldMapColumn } from '@/lib/pbv/form-generation/stamper';

export type { FieldMap, FlatField, RowPattern, FieldMapColumn };

/** A page's media box — the bounds all placement is validated against. */
export interface PageBox {
  /** 1-based page number (matches FieldMap `page`). */
  page: number;
  width: number;
  height: number;
}

export interface IngestResult {
  sourcePdfBytes: Uint8Array;
  pageCount: number;
  pages: PageBox[];
}

/** A resolved rectangle in pdf-lib space (x,y = bottom-left corner). */
export interface Rect {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Identifier for reporting: flat field name, or `${rowPatternId}[${rowIdx}].${col}`. */
  name: string;
}

export type FindingKind =
  | 'out_of_bounds'
  | 'overlap'
  | 'row_overflow'
  | 'ocr_missing'
  | 'ocr_truncated'
  | 'ocr_mismatch'
  // Placement validators (rasterization-free; computed from font metrics + the
  // source PDF text/vector layers). These catch the defect classes the
  // geometric/OCR checks miss — see placement.ts.
  | 'overprint' //      a stamped value sits on top of a PRINTED label
  | 'offpage_text' //   a value's TRUE rendered width runs past the page edge
  | 'column_misaligned' // a table column renders under the wrong cell/header
  | 'value_collision'; //  two stamped values overprint EACH OTHER (e.g. collapsed columns)

export interface ValidationFinding {
  kind: FindingKind;
  formId: string;
  field: string;
  page: number;
  box?: Rect;
  reason: string;
}

export type OcrStatus = 'pass' | 'flagged' | 'skipped';

export interface ValidationReport {
  formId: string;
  pass: boolean;
  geometric: ValidationFinding[];
  /**
   * Placement findings (overprint / offpage_text / column_misaligned). These are
   * the deterministic, rasterization-free safety net and count toward `pass`:
   * an improperly-templated form fails loudly here rather than passing silently.
   */
  placement: ValidationFinding[];
  ocrStatus: OcrStatus;
  ocrReason?: string;
  ocr: ValidationFinding[];
}

// ── Source-PDF signal types (extracted from the text + vector layers) ───────────

/** A printed word from the source PDF text layer, in pdf-lib space (y = baseline). */
export type PrintedWordClass = 'fill_line' | 'real_label';
export interface PrintedWord {
  page: number;
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** `fill_line` = underscores/dots/dashes (values BELONG here); `real_label` = has text. */
  cls: PrintedWordClass;
}

/** A vertical rule (table column boundary) recovered from the vector layer. */
export interface VerticalRule {
  page: number;
  x: number;
  yTop: number;
  yBottom: number;
}

/** A rectangular cell/region recovered from the vector layer (pdf-lib space). */
export interface CellBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Default overlap tolerance in points before a flag fires (open question #4). */
export const DEFAULT_OVERLAP_TOLERANCE = 2;

/** Overlap (pts) a stamped value may share with a printed label before `overprint` fires. */
export const OVERPRINT_TOLERANCE = 2;

/** How far (pts) a table column's x may sit from its cell/header before `column_misaligned` fires. */
export const COLUMN_MISALIGN_TOLERANCE = 8;

/**
 * A printed word is a "fill line" (values are SUPPOSED to sit on it) when it is
 * only underscores / hyphens / dots / dashes / whitespace. Anything with a
 * letter or digit is a real label. Used by classifyWord (see textlayer.ts).
 */
export const FILL_LINE_RE = /^[_\-.—–\s]+$/;

/** Approximate text height as a multiple of font size (ascender+descender headroom). */
export const TEXT_HEIGHT_FACTOR = 1.2;

/** Fallback width (pts) for a flat text field with no declared width. */
export const DEFAULT_TEXT_WIDTH = 120;

/** Default font size for flat fields / row columns, mirroring stamper.ts defaults. */
export const DEFAULT_FLAT_FONT_SIZE = 11;
export const DEFAULT_ROW_FONT_SIZE = 9;

// ── Pluggable rasterizer + OCR engine (for the OCR round-trip validator) ────────

/**
 * Rasterize one page of a rendered PDF to a JPEG buffer. Returns null when the
 * environment cannot rasterize (e.g. sharp without libvips PDF support) — the
 * OCR validator then reports `skipped` rather than failing.
 */
export interface Rasterizer {
  rasterizePage(pdfBytes: Uint8Array, page: number): Promise<Buffer | null>;
}

/** OCR a JPEG image (base64, no data-URI prefix) → extracted text. */
export interface OcrEngine {
  ocr(jpegBase64: string): Promise<string>;
}
