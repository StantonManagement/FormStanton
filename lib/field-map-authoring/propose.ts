/**
 * lib/field-map-authoring/propose.ts
 *
 * PRD-86 Phase A — "a few passes" that propose a draft FieldMap from a PDF.
 *
 * Pass 1 (anchors): extract the text layer (pdfjs-dist) and detect fill targets —
 *   underscore runs and label tokens — as candidate regions (page, x, y, w, h).
 * Pass 2 (mapping): match label text against known conventions to assign a data
 *   key + font size. Unmapped candidates are marked `fresh_input` (left blank),
 *   not guessed.
 * Pass 3 (geometry): fit width to available horizontal space.
 *
 * Output is a draft `FieldMap` in the exact stamper.ts shape. This is best-effort
 * scaffolding for NEW documents; the operator corrects placements and approves.
 * (Correcting EXISTING maps does not use these passes — see autocorrect.ts.)
 */

import { type FieldMap, type FlatField, type PageBox } from './types';

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

/** Convention dictionary: lowercased label substring → { dataKey, fontSize }. */
const LABEL_CONVENTIONS: { match: RegExp; dataKey: string; fontSize?: number }[] = [
  { match: /social security|ssn/, dataKey: 'ssn' },
  { match: /date of birth|dob|birth ?date/, dataKey: 'dob' },
  { match: /first name/, dataKey: 'first_name' },
  { match: /last name/, dataKey: 'last_name' },
  { match: /middle (initial|name)|^mi\b/, dataKey: 'middle_initial' },
  { match: /full name|applicant name|^name/, dataKey: 'applicant_full_name' },
  { match: /e-?mail/, dataKey: 'applicant_email' },
  { match: /phone|telephone|cell/, dataKey: 'phone_cell' },
  { match: /street|address/, dataKey: 'address_street' },
  { match: /city.*state.*zip|city\/state/, dataKey: 'address_city_state_zip' },
  { match: /signature/, dataKey: 'signature' },
  { match: /date(?!\s*of)/, dataKey: 'date' },
];

async function extractTextItems(pdfBytes: Uint8Array): Promise<TextItem[]> {
  // Legacy build is the Node-friendly entry but ships no type declarations;
  // load via a non-literal specifier so it resolves at runtime as `any`.
  const legacySpecifier = 'pdfjs-dist/legacy/build/pdf.js';
  const pdfjs: any = await import(/* @vite-ignore */ legacySpecifier);
  const pdf = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const items: TextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
      if (!it.str || !it.transform) continue;
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width ?? 0,
        height: it.height ?? 10,
        page: p,
      });
    }
  }
  return items;
}

function mapLabel(label: string): { dataKey: string; fontSize?: number } | null {
  const l = label.toLowerCase();
  for (const c of LABEL_CONVENTIONS) {
    if (c.match.test(l)) return { dataKey: c.dataKey, fontSize: c.fontSize };
  }
  return null;
}

export interface ProposeResult {
  fieldMap: FieldMap;
  unmappedCount: number;
}

/**
 * Propose a draft field map. `formId` and `sourcePdf` are carried into the output
 * unchanged. Each detected label becomes a candidate placed to its right.
 */
export async function proposeFieldMap(
  formId: string,
  sourcePdfRef: string,
  sourcePdfBytes: Uint8Array,
  pages: PageBox[]
): Promise<ProposeResult> {
  const items = await extractTextItems(sourcePdfBytes);
  const byPageWidth = new Map(pages.map((p) => [p.page, p.width]));

  const fields: FlatField[] = [];
  let unmappedCount = 0;
  let freshIdx = 0;

  // Pass 1+2: treat label-bearing text items as anchors; place a fill region to
  // the right of the label baseline.
  for (const item of items) {
    const trimmed = item.str.trim();
    if (!trimmed || trimmed.length < 2) continue;
    // Skip items that are themselves just fill lines.
    if (/^[_\s]+$/.test(trimmed)) continue;

    const mapped = mapLabel(trimmed);
    const startX = item.x + item.width + 6;
    const pageWidth = byPageWidth.get(item.page) ?? 612;
    // Pass 3: width = remaining horizontal space (capped).
    const width = Math.max(40, Math.min(240, pageWidth - startX - 12));
    if (width < 40) continue;

    if (mapped) {
      fields.push({
        name: mapped.dataKey,
        type: mapped.dataKey === 'signature' ? 'image' : 'text',
        page: item.page,
        x: startX,
        y: item.y,
        width,
        font_size: mapped.fontSize ?? 11,
      });
    } else {
      // Unmapped → fresh_input: rendered blank (no data key resolves to it).
      unmappedCount++;
      fields.push({
        name: `fresh_input_${freshIdx++}`,
        type: 'text',
        page: item.page,
        x: startX,
        y: item.y,
        width,
        font_size: 11,
      });
    }
  }

  const fieldMap: FieldMap = {
    form_id: formId,
    source_pdf: sourcePdfRef,
    fields,
  };

  return { fieldMap, unmappedCount };
}
