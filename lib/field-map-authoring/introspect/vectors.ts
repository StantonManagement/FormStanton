/**
 * lib/field-map-authoring/introspect/vectors.ts
 *
 * Vector-layer extraction — table column/row rules and cell boxes recovered from
 * the source PDF's drawing operators. This is the precise signal for the
 * "wrong column" defect class (header text is centered and ambiguous; gridlines
 * are not).
 *
 * pdfjs `getOperatorList()` yields `constructPath` ops whose 3rd arg is the
 * path's bounding box {0:minX,1:minY,2:maxX,3:maxY} in user space. We track the
 * CTM across save/restore/transform and map each bbox to page space (the corpus
 * draws table lines with an identity CTM, but we stay correct generally), then
 * classify: a near-zero-width tall bbox is a vertical rule (column boundary), a
 * near-zero-height wide bbox is a horizontal rule (row boundary), and a box with
 * both dimensions is a cell/outline. Coordinates are pdf-lib space (bottom-left).
 */

import { loadPdfjs } from '../textlayer';
import type { VerticalRule, CellBox } from '../types';

export interface HorizontalRule {
  page: number;
  y: number;
  xLeft: number;
  xRight: number;
}

export interface VectorRegions {
  verticalRules: VerticalRule[];
  horizontalRules: HorizontalRule[];
  cells: CellBox[];
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** pdfjs Util.transform(m1, m2): the matrix that applies m2 then m1. */
function mul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
function applyPt(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const RULE_THICKNESS = 2; // a rule's narrow dimension stays under this (pts)
const MIN_RULE_LEN = 3; // a rule's long dimension exceeds this (pts)

/** Extract vertical/horizontal rules + cell boxes from every page's vector layer. */
export async function extractVectorRegions(pdfBytes: Uint8Array): Promise<VectorRegions> {
  const pdfjs: any = await loadPdfjs();
  const OPS = pdfjs.OPS;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;

  const verticalRules: VerticalRule[] = [];
  const horizontalRules: HorizontalRule[] = [];
  const cells: CellBox[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const ol = await page.getOperatorList();
    let ctm: Matrix = IDENTITY;
    const stack: Matrix[] = [];

    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i];
      if (fn === OPS.save) {
        stack.push(ctm);
      } else if (fn === OPS.restore) {
        ctm = stack.pop() ?? IDENTITY;
      } else if (fn === OPS.transform) {
        const a = ol.argsArray[i] as number[];
        ctm = mul(ctm, [a[0], a[1], a[2], a[3], a[4], a[5]]);
      } else if (fn === OPS.constructPath) {
        const mm = ol.argsArray[i]?.[2];
        if (!mm) continue;
        const minX = mm[0] ?? mm['0'];
        const minY = mm[1] ?? mm['1'];
        const maxX = mm[2] ?? mm['2'];
        const maxY = mm[3] ?? mm['3'];
        if ([minX, minY, maxX, maxY].some((v) => typeof v !== 'number')) continue;
        // Map the bbox corners through the CTM, then re-derive an axis-aligned box.
        const c0 = applyPt(ctm, minX, minY);
        const c1 = applyPt(ctm, maxX, maxY);
        const x0 = Math.min(c0[0], c1[0]);
        const x1 = Math.max(c0[0], c1[0]);
        const y0 = Math.min(c0[1], c1[1]);
        const y1 = Math.max(c0[1], c1[1]);
        const w = x1 - x0;
        const h = y1 - y0;
        if (w <= RULE_THICKNESS && h >= MIN_RULE_LEN) {
          verticalRules.push({ page: p, x: (x0 + x1) / 2, yTop: y1, yBottom: y0 });
        } else if (h <= RULE_THICKNESS && w >= MIN_RULE_LEN) {
          horizontalRules.push({ page: p, y: (y0 + y1) / 2, xLeft: x0, xRight: x1 });
        } else if (w > RULE_THICKNESS && h > RULE_THICKNESS) {
          cells.push({ page: p, x: x0, y: y0, width: w, height: h });
        }
      }
    }
  }

  return { verticalRules, horizontalRules, cells };
}
