/**
 * lib/pbv/form-generation/stamper.ts
 *
 * TypeScript port of scripts/stamp-form.mjs.
 * Accepts a field map + data object + source PDF bytes → returns stamped PDF Buffer.
 * No filesystem reads (caller provides bytes). No shell-out.
 *
 * Supports:
 *   - fieldMap.fields          — flat field array (text, image)
 *   - fieldMap.row_patterns    — array of repeating-row table patterns
 *   - fieldMap.row_pattern     — singular repeating-row pattern (legacy)
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldMapColumn {
  field_prefix?: string;
  member_key?: string;
  type: 'text' | 'image' | 'checkbox';
  x: number;
  y_offset?: number;
  font_size?: number;
  check_value?: string;
  width?: number;
  height?: number;
}

export interface RowPattern {
  id?: string;
  data_key: string;
  page?: number;
  row_start_y: number;
  row_pitch: number;
  max_rows?: number;
  columns: FieldMapColumn[];
}

export interface FlatField {
  name: string;
  type: 'text' | 'image';
  page?: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  font_size?: number;
}

export interface FieldMap {
  form_id: string;
  source_pdf: string;
  fields: FlatField[];
  row_patterns?: RowPattern[];
  row_pattern?: RowPattern;
}

export interface StamperInput {
  fieldMap: FieldMap;
  data: Record<string, unknown>;
  sourcePdfBytes: Uint8Array;
  imageResolver?: (imagePath: string) => Promise<Uint8Array | null>;
}

// ─── Core stamp function ──────────────────────────────────────────────────────

export async function stampForm(input: StamperInput): Promise<Buffer> {
  const { fieldMap, data, sourcePdfBytes, imageResolver } = input;

  const pdfDoc = await PDFDocument.load(sourcePdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Helper: get page safely
  const getPage = (pageNum: number) => {
    const idx = (pageNum || 1) - 1;
    const page = pdfDoc.getPages()[idx];
    if (!page) throw new Error(`Page ${pageNum} not found in source PDF (has ${pdfDoc.getPageCount()} pages)`);
    return page;
  };

  // Helper: embed and draw image from bytes
  const drawImage = async (
    pageNum: number,
    imageBytes: Uint8Array,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const page = getPage(pageNum);
    const ext = 'png';
    const embedded = ext === 'png'
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);
    page.drawImage(embedded, { x, y, width, height });
  };

  // ── row_patterns (plural array) ─────────────────────────────────────────────
  if (Array.isArray(fieldMap.row_patterns)) {
    for (const rp of fieldMap.row_patterns) {
      const rows = data[rp.data_key];
      if (!Array.isArray(rows) || rows.length === 0) continue;

      const maxRows = rp.max_rows ?? 9;
      for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
        const row = rows[i] as Record<string, unknown>;
        const rowY = rp.row_start_y - i * rp.row_pitch;

        for (const col of rp.columns) {
          const key = col.field_prefix ?? col.member_key ?? '';
          const value = row[key];
          if (value === undefined || value === null || value === '') continue;

          const page = getPage(rp.page ?? 1);
          const yPos = rowY + (col.y_offset ?? 5);

          if (col.type === 'text') {
            page.drawText(String(value), {
              x: col.x,
              y: yPos,
              size: col.font_size ?? 9,
              font,
              color: rgb(0, 0, 0),
            });
          } else if (col.type === 'checkbox') {
            if (String(value) === String(col.check_value)) {
              page.drawText('X', {
                x: col.x,
                y: yPos,
                size: col.font_size ?? 9,
                font,
                color: rgb(0, 0, 0),
              });
            }
          } else if (col.type === 'image') {
            // F5: Handle per-row signature images
            const key = col.member_key ?? col.field_prefix ?? '';
            if (key.includes('signature')) {
              // Look for per-row signature marker: __row_pattern:{data_key}:signature:{rowIndex}
              const rowMarker = `__row_pattern:${rp.data_key}:signature:${i}`;
              const markerValue = data[rowMarker];
              if (markerValue && imageResolver) {
                const imgBytes = await imageResolver(String(markerValue));
                if (imgBytes) {
                  await drawImage(
                    rp.page ?? 1,
                    imgBytes,
                    col.x,
                    yPos - (col.height ?? 20) + (col.y_offset ?? 0),
                    col.width ?? 100,
                    col.height ?? 20
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  // ── row_pattern (singular, legacy) ─────────────────────────────────────────
  if (fieldMap.row_pattern) {
    const rp = fieldMap.row_pattern;
    const members = data[rp.data_key];
    if (Array.isArray(members)) {
      const maxRows = rp.max_rows ?? 9;
      for (let i = 0; i < Math.min(members.length, maxRows); i++) {
        const member = members[i] as Record<string, unknown>;
        const rowY = rp.row_start_y - i * rp.row_pitch;

        for (const col of rp.columns) {
          const key = col.member_key ?? col.field_prefix ?? '';
          const value = member[key];
          if (value === undefined || value === null) continue;

          const page = getPage(rp.page ?? 1);
          const yPos = rowY + (col.y_offset ?? 5);

          if (col.type === 'text') {
            page.drawText(String(value), {
              x: col.x,
              y: yPos,
              size: col.font_size ?? 9,
              font,
              color: rgb(0, 0, 0),
            });
          } else if (col.type === 'checkbox') {
            if (String(value) === String(col.check_value)) {
              page.drawText('X', {
                x: col.x,
                y: yPos,
                size: col.font_size ?? 9,
                font,
                color: rgb(0, 0, 0),
              });
            }
          } else if (col.type === 'image') {
            // F5: Handle per-row signature images for legacy row_pattern
            if (key.includes('signature') && imageResolver) {
              const rowMarker = `__row_pattern:${rp.data_key}:signature:${i}`;
              const markerValue = data[rowMarker];
              if (markerValue) {
                const imgBytes = await imageResolver(String(markerValue));
                if (imgBytes) {
                  await drawImage(
                    rp.page ?? 1,
                    imgBytes,
                    col.x,
                    yPos - (col.height ?? 20) + (col.y_offset ?? 0),
                    col.width ?? 100,
                    col.height ?? 20
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  // ── flat fields ─────────────────────────────────────────────────────────────
  for (const field of fieldMap.fields) {
    const value = data[field.name];
    if (value === undefined || value === null) continue;

    const page = getPage(field.page ?? 1);

    if (field.type === 'text') {
      page.drawText(String(value), {
        x: field.x,
        y: field.y,
        size: field.font_size ?? 11,
        font,
        color: rgb(0, 0, 0),
      });
    } else if (field.type === 'image') {
      if (!imageResolver) continue;
      const imageBytes = await imageResolver(String(value));
      if (!imageBytes) continue;
      await drawImage(
        field.page ?? 1,
        imageBytes,
        field.x,
        field.y,
        field.width ?? 200,
        field.height ?? 50
      );
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
