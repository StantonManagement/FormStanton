/**
 * lib/field-map-authoring/introspect/widgets.ts
 *
 * AcroForm widget extraction — the STRONGEST placement signal when present.
 * Where a source PDF has interactive form fields, the field author already told
 * us exactly where each field goes (name + rectangle), so the resolver can place
 * data with zero coordinate guessing and overprint/off-page become impossible.
 *
 * Inconsistent across the PBV corpus (main-application-en has 154 widgets; every
 * ES form and most EN forms have 0), so this is one rung of the authoring ladder,
 * not a universal mechanism. Uses pdfjs annotations: `.rect` is already in
 * pdf-lib space (bottom-left), `.fieldName`/`.fieldType` give name + kind.
 */

import { loadPdfjs } from '../textlayer';

export type WidgetType = 'text' | 'checkbox' | 'choice' | 'signature' | 'button' | 'unknown';

export interface Widget {
  page: number; // 1-based
  name: string;
  type: WidgetType;
  /** pdf-lib space, bottom-left origin. */
  x: number;
  y: number;
  width: number;
  height: number;
}

function mapFieldType(fieldType: string | undefined, fieldName: string): WidgetType {
  switch (fieldType) {
    case 'Tx':
      return 'text';
    case 'Btn':
      return /sign/i.test(fieldName) ? 'signature' : 'checkbox';
    case 'Ch':
      return 'choice';
    case 'Sig':
      return 'signature';
    default:
      return 'unknown';
  }
}

/** Extract AcroForm widgets with boxes, in pdf-lib space, across all pages. */
export async function extractWidgets(pdfBytes: Uint8Array): Promise<Widget[]> {
  const pdfjs: any = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const widgets: Widget[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    let annots: any[] = [];
    try {
      annots = await page.getAnnotations();
    } catch {
      continue;
    }
    for (const a of annots) {
      if (a.subtype !== 'Widget') continue;
      const rect = a.rect as number[] | undefined; // [x1,y1,x2,y2] PDF space
      if (!rect || rect.length < 4) continue;
      const x = Math.min(rect[0], rect[2]);
      const y = Math.min(rect[1], rect[3]);
      const width = Math.abs(rect[2] - rect[0]);
      const height = Math.abs(rect[3] - rect[1]);
      const name = (a.fieldName as string) ?? '';
      if (!name) continue;
      widgets.push({ page: p, name, type: mapFieldType(a.fieldType, name), x, y, width, height });
    }
  }
  return widgets;
}
