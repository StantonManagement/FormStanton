/**
 * lib/field-map-authoring/previewA.ts
 *
 * PRD-86 Phase A — Preview A: the grayed-out write-spacing proof.
 *
 * Renders the source PDF with a translucent rectangle at every field / row-cell
 * box (no text). Boxes that overlap another box or fall outside the media box
 * are tinted a warning color so spacing defects are visible at a glance, and are
 * also returned as a list.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { type FieldMap, type PageBox, type Rect } from './types';
import { fieldMapToRects, isWithinBox, rectsOverlap } from './geometric';

export interface PreviewAResult {
  pdf: Buffer;
  flaggedBoxes: { rect: Rect; reason: 'overlap' | 'out_of_bounds' }[];
}

export async function renderPreviewA(
  sourcePdfBytes: Uint8Array,
  fieldMap: FieldMap,
  pages: PageBox[]
): Promise<PreviewAResult> {
  const doc = await PDFDocument.load(sourcePdfBytes);
  const rects = fieldMapToRects(fieldMap);
  const byPage = new Map(pages.map((p) => [p.page, p]));
  const flaggedBoxes: PreviewAResult['flaggedBoxes'] = [];

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    const pdfPage = doc.getPages()[rect.page - 1];
    if (!pdfPage) continue;

    const box = byPage.get(rect.page);
    const oob = box ? !isWithinBox(rect, box) : true;
    const overlaps = rects.some((other, j) => j !== i && rectsOverlap(rect, other));
    const flagged = oob || overlaps;

    if (flagged) {
      flaggedBoxes.push({ rect, reason: oob ? 'out_of_bounds' : 'overlap' });
    }

    // Clamp the drawn rectangle so an out-of-bounds box is still visible on-page.
    const drawW = Math.min(rect.width, (box?.width ?? rect.x + rect.width) - rect.x);
    const drawH = Math.min(rect.height, (box?.height ?? rect.y + rect.height) - rect.y);

    pdfPage.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: Math.max(1, drawW),
      height: Math.max(1, drawH),
      color: flagged ? rgb(0.9, 0.3, 0.2) : rgb(0.5, 0.5, 0.5),
      opacity: flagged ? 0.45 : 0.28,
      borderColor: flagged ? rgb(0.8, 0.1, 0.1) : rgb(0.4, 0.4, 0.4),
      borderWidth: flagged ? 1 : 0.5,
      borderOpacity: 0.8,
    });
  }

  const bytes = await doc.save();
  return { pdf: Buffer.from(bytes), flaggedBoxes };
}
