/**
 * lib/field-map-authoring/ingest.ts
 *
 * PRD-86 Phase A — load a source PDF and record page count + media boxes.
 * Media boxes are the bounds every placement is validated against. Coordinate
 * space is pdf-lib's (origin bottom-left).
 */

import { PDFDocument } from 'pdf-lib';
import { type IngestResult, type PageBox } from './types';

export async function ingestSourcePdf(sourcePdfBytes: Uint8Array): Promise<IngestResult> {
  const doc = await PDFDocument.load(sourcePdfBytes);
  const pageCount = doc.getPageCount();
  const pages: PageBox[] = [];
  for (let i = 0; i < pageCount; i++) {
    const { width, height } = doc.getPage(i).getSize();
    pages.push({ page: i + 1, width, height });
  }
  return { sourcePdfBytes, pageCount, pages };
}
