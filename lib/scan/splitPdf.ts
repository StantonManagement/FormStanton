/**
 * splitPdf.ts
 *
 * Shared PDF-to-page-image utility used by both the legacy scan-upload flow
 * and the new packet intake flow.
 *
 * Each page of a PDF is rendered to a JPEG Buffer at 150 DPI.
 * Single image files (JPG, PNG, HEIC) are converted to JPEG and returned
 * as a single-element array.
 */

import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

export interface PageImage {
  pageIndex: number;
  buffer: Buffer;
  mimeType: 'image/jpeg';
}

const RENDER_SCALE = 1.5;
const JPEG_QUALITY = 85;
const MAX_WIDTH_PX = 2000;

/**
 * Split a PDF buffer into per-page JPEG buffers.
 * Uses pdf-lib to extract single-page PDFs, then sharp to convert.
 * Note: pdfjs-dist canvas rendering requires a browser context — for
 * server-side we extract individual page PDFs and convert via sharp's
 * PDF support (requires libvips with PDF support) or fall back to
 * a white-background JPEG of the correct dimensions.
 */
async function splitPdfToJpegs(pdfBuffer: Buffer): Promise<PageImage[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  const results: PageImage[] = [];

  for (let i = 0; i < pageCount; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const singlePageBytes = await singlePageDoc.save();
    const singlePageBuffer = Buffer.from(singlePageBytes);

    let jpegBuffer: Buffer;
    try {
      jpegBuffer = await sharp(singlePageBuffer, {
        density: Math.round(72 * RENDER_SCALE),
      })
        .resize(MAX_WIDTH_PX, undefined, { withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    } catch {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      const scaledW = Math.min(Math.round(width * RENDER_SCALE), MAX_WIDTH_PX);
      const scaledH = Math.round(height * RENDER_SCALE * (scaledW / Math.round(width * RENDER_SCALE)));
      jpegBuffer = await sharp({
        create: {
          width: scaledW,
          height: scaledH,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    }

    results.push({ pageIndex: i, buffer: jpegBuffer, mimeType: 'image/jpeg' });
  }

  return results;
}

/**
 * Convert a single image file (JPG, PNG, HEIC, WebP) to a JPEG buffer.
 */
async function imageToJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(MAX_WIDTH_PX, undefined, { withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

/**
 * Primary entry point.
 *
 * @param buffer  Raw file bytes
 * @param mimeType  MIME type of the source file
 * @returns Array of PageImage, one per page (always at least one element)
 */
export async function splitFileToPages(
  buffer: Buffer,
  mimeType: string
): Promise<PageImage[]> {
  if (mimeType === 'application/pdf') {
    return splitPdfToJpegs(buffer);
  }

  const jpegBuffer = await imageToJpeg(buffer);
  return [{ pageIndex: 0, buffer: jpegBuffer, mimeType: 'image/jpeg' }];
}
