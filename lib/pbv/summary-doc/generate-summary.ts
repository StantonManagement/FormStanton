/**
 * lib/pbv/summary-doc/generate-summary.ts
 *
 * Generates the PBV Application Summary PDF using pdf-lib.
 * One-page, programmatic generation. No source PDF template.
 *
 * Input: GenerateSummaryInput
 * Output: Uint8Array (PDF bytes)
 *
 * Idempotency: same inputs → same logical content.
 * Layout: Stanton letterhead, branded primary color, all sections from PRD-28 § 2.
 *
 * Template version: SUMMARY_TEMPLATE_VERSION (exported from content.ts)
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import { SUMMARY_CONTENT, SUMMARY_TEMPLATE_VERSION, type Language } from './content';
import { getFormDescription, getUploadDescription } from './descriptions';

// ─── Brand colors ─────────────────────────────────────────────────────────────
// Stanton primary — deep institutional navy, consistent with design system
const PRIMARY_R = 0.11;
const PRIMARY_G = 0.22;
const PRIMARY_B = 0.38;

const MUTED_R = 0.40;
const MUTED_G = 0.40;
const MUTED_B = 0.40;

// ─── Layout constants ──────────────────────────────────────────────────────────
const PAGE_WIDTH = 612;    // US Letter
const PAGE_HEIGHT = 792;
const MARGIN_L = 56;
const MARGIN_R = 56;
const CONTENT_W = PAGE_WIDTH - MARGIN_L - MARGIN_R;

// ─── Input types ──────────────────────────────────────────────────────────────

export interface FormEntry {
  form_id: string;
  display_name?: string;
}

export interface UploadEntry {
  category_key: string;
  label?: string;
}

export interface GenerateSummaryInput {
  hohName: string;
  address?: string;
  applicationId: string;
  language: Language;
  submissionLanguage: 'en' | 'es';
  forms: FormEntry[];
  uploads: UploadEntry[];
  generatedAt?: Date;
}

// ─── Layout cursor helper ──────────────────────────────────────────────────────

class Cursor {
  y: number;
  constructor(startY: number) { this.y = startY; }
  move(delta: number) { this.y -= delta; }
  get pos() { return this.y; }
}

// ─── Text utilities ────────────────────────────────────────────────────────────

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  r: number, g: number, b: number
) {
  page.drawText(text, { x, y, font, size, color: rgb(r, g, b) });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  startY: number,
  font: PDFFont,
  size: number,
  lineHeight: number,
  maxWidth: number,
  r: number, g: number, b: number
): number {
  const lines = wrapText(text, font, size, maxWidth);
  let y = startY;
  for (const line of lines) {
    drawText(page, line, x, y, font, size, r, g, b);
    y -= lineHeight;
  }
  return startY - lines.length * lineHeight;
}

// ─── Main generator ────────────────────────────────────────────────────────────

export async function generateSummaryPdf(input: GenerateSummaryInput): Promise<Uint8Array> {
  const { hohName, address, language, submissionLanguage, forms, uploads, generatedAt } = input;
  const c = SUMMARY_CONTENT[language] ?? SUMMARY_CONTENT.en;
  const dateStr = (generatedAt ?? new Date()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const cursor = new Cursor(PAGE_HEIGHT - 48);

  // ── Letterhead ──────────────────────────────────────────────────────────────
  drawText(page, 'STANTON MANAGEMENT', MARGIN_L, cursor.pos, boldFont, 11, PRIMARY_R, PRIMARY_G, PRIMARY_B);
  cursor.move(14);
  drawText(page, '43 Frank Street  \u00b7  Hartford, CT  \u00b7  (860) 555-0100', MARGIN_L, cursor.pos, regularFont, 8, MUTED_R, MUTED_G, MUTED_B);
  cursor.move(12);

  // Horizontal rule
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.pos },
    end: { x: PAGE_WIDTH - MARGIN_R, y: cursor.pos },
    thickness: 0.5,
    color: rgb(PRIMARY_R, PRIMARY_G, PRIMARY_B),
  });
  cursor.move(16);

  // ── Document title ───────────────────────────────────────────────────────────
  drawText(page, c.doc_title.toUpperCase(), MARGIN_L, cursor.pos, boldFont, 14, PRIMARY_R, PRIMARY_G, PRIMARY_B);
  cursor.move(16);

  // For: HOH name + address
  const forLine = `${c.for_label}: ${hohName}${address ? '  \u00b7  ' + address : ''}`;
  drawText(page, forLine, MARGIN_L, cursor.pos, regularFont, 9, 0.2, 0.2, 0.2);
  cursor.move(6);
  drawText(page, dateStr, MARGIN_L, cursor.pos, regularFont, 8, MUTED_R, MUTED_G, MUTED_B);
  cursor.move(18);

  // Horizontal rule
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.pos },
    end: { x: PAGE_WIDTH - MARGIN_R, y: cursor.pos },
    thickness: 0.3,
    color: rgb(0.8, 0.8, 0.8),
  });
  cursor.move(14);

  // ── Helper: draw section ─────────────────────────────────────────────────────
  const drawSection = (title: string, body?: string) => {
    drawText(page, title, MARGIN_L, cursor.pos, boldFont, 9, PRIMARY_R, PRIMARY_G, PRIMARY_B);
    cursor.move(12);
    if (body) {
      const endY = drawWrappedText(page, body, MARGIN_L, cursor.pos, regularFont, 8.5, 12, CONTENT_W, 0.15, 0.15, 0.15);
      cursor.y = endY;
      cursor.move(10);
    }
  };

  const drawBullet = (text: string) => {
    drawText(page, '\u2022', MARGIN_L, cursor.pos, regularFont, 8.5, 0.15, 0.15, 0.15);
    const endY = drawWrappedText(page, text, MARGIN_L + 12, cursor.pos, regularFont, 8.5, 11, CONTENT_W - 12, 0.15, 0.15, 0.15);
    cursor.y = endY;
    cursor.move(3);
  };

  // ── Section: What You Are Applying For ──────────────────────────────────────
  drawSection(c.section_what_applying_for_title, c.section_what_applying_for_body);

  // ── Section: Forms package ───────────────────────────────────────────────────
  drawSection(c.section_package_title);
  for (const form of forms) {
    const desc = getFormDescription(language, form.form_id);
    const label = form.display_name ?? form.form_id;
    drawBullet(`${label}: ${desc}`);
  }
  cursor.move(8);

  // ── Section: Uploads ─────────────────────────────────────────────────────────
  drawSection(c.section_uploads_title);
  if (uploads.length === 0) {
    drawText(page, c.section_uploads_none, MARGIN_L, cursor.pos, regularFont, 8.5, MUTED_R, MUTED_G, MUTED_B);
    cursor.move(14);
  } else if (uploads.length <= 8) {
    for (const u of uploads) {
      const desc = getUploadDescription(language, u.category_key);
      const label = u.label ?? u.category_key;
      drawBullet(`${label}: ${desc}`);
    }
  } else {
    // >8 uploads: collapse
    const collapsedText = language === 'es'
      ? 'Documentos de respaldo (consulte su portal para la lista completa).'
      : language === 'pt'
      ? 'Documentos de suporte (consulte seu portal para a lista completa).'
      : 'Supporting documents (see your portal for the full list).';
    drawBullet(collapsedText);
  }
  cursor.move(4);

  // ── Section: Language note ────────────────────────────────────────────────────
  const langNoteBody = c.section_language_note_body(submissionLanguage, language);
  drawSection(c.section_language_note_title, langNoteBody);

  // ── Section: Contact ─────────────────────────────────────────────────────────
  drawSection(c.section_contact_title, c.section_contact_body(language));

  // ── Section: Acknowledgement ──────────────────────────────────────────────────
  drawSection(c.section_acknowledgement_title, c.section_acknowledgement_body);

  // ── Signature block ───────────────────────────────────────────────────────────
  cursor.move(8);
  page.drawLine({
    start: { x: MARGIN_L, y: cursor.pos },
    end: { x: MARGIN_L + 220, y: cursor.pos },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
  });
  cursor.move(4);
  drawText(page, c.signature_line_label, MARGIN_L, cursor.pos, regularFont, 8, MUTED_R, MUTED_G, MUTED_B);
  cursor.move(22);

  page.drawLine({
    start: { x: MARGIN_L, y: cursor.pos },
    end: { x: MARGIN_L + 120, y: cursor.pos },
    thickness: 0.5,
    color: rgb(0.3, 0.3, 0.3),
  });
  cursor.move(4);
  drawText(page, c.date_label, MARGIN_L, cursor.pos, regularFont, 8, MUTED_R, MUTED_G, MUTED_B);

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footerY = 28;
  drawText(page, `Template v${SUMMARY_TEMPLATE_VERSION}  \u00b7  Stanton Management  \u00b7  Confidential`, MARGIN_L, footerY, regularFont, 7, MUTED_R, MUTED_G, MUTED_B);

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}
