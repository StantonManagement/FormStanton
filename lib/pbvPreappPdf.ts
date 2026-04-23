import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { drawHeader, drawFooter, wrapText, drawTextBlock } from './pdfTemplates';
import type { PbvPreapplication, HouseholdMember } from '@/types/compliance';

const QUAL_LABELS: Record<string, string> = {
  likely_qualifies: 'Likely Qualifies',
  over_income: 'Over Income',
  citizenship_issue: 'Citizenship Issue',
  over_income_and_citizenship: 'Over Income + Citizenship',
};

const REVIEW_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  denied: 'Denied',
  needs_info: 'Needs Info',
};

function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return '$' + n.toLocaleString('en-US');
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtBool(b: boolean | null | undefined, yesLabel = 'Yes', noLabel = 'No'): string {
  if (b === null || b === undefined) return '—';
  return b ? yesLabel : noLabel;
}

function sectionHeading(page: any, x: number, y: number, text: string, font: any): number {
  page.drawRectangle({ x, y: y - 2, width: 512, height: 16, color: rgb(0.93, 0.93, 0.93) });
  page.drawText(text.toUpperCase(), { x: x + 4, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  return y - 20;
}

function labelValue(
  page: any,
  x: number,
  y: number,
  label: string,
  value: string,
  fontBold: any,
  fontReg: any,
): number {
  page.drawText(label + ':', { x, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(value, { x: x + 150, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) });
  return y - 14;
}

export async function generatePbvPreappSummaryPdf(app: PbvPreapplication): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;

  let page = pdfDoc.addPage([612, 792]);
  let pageNum = 1;

  // Draw Stanton header + title
  let y = drawHeader(page, fontBold, fontReg, 'PBV Pre-Application Summary', margin);
  y -= 6;

  // Generation line
  page.drawText(
    `Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}   |   ID: ${app.id.slice(0, 8).toUpperCase()}`,
    { x: margin, y, size: 8, font: fontReg, color: rgb(0.5, 0.5, 0.5) },
  );
  y -= 20;
  drawFooter(pdfDoc, page, fontReg, pageNum, margin);

  // ── Head of Household ──────────────────────────────────────────────────
  y = sectionHeading(page, margin, y, 'Head of Household', fontBold);
  y = labelValue(page, margin, y, 'Name', app.hoh_name, fontBold, fontReg);
  y = labelValue(page, margin, y, 'Date of Birth', fmtDate(app.hoh_dob), fontBold, fontReg);
  y = labelValue(page, margin, y, 'Building', app.building_address, fontBold, fontReg);
  y = labelValue(page, margin, y, 'Unit', app.unit_number, fontBold, fontReg);
  y = labelValue(page, margin, y, 'Language', app.language.toUpperCase(), fontBold, fontReg);
  y = labelValue(page, margin, y, 'Submitted', fmtDate(app.created_at), fontBold, fontReg);
  y -= 10;

  // ── Qualification Analysis ─────────────────────────────────────────────
  y = sectionHeading(page, margin, y, 'Qualification Analysis', fontBold);
  const incomeOk = app.income_limit === null || app.total_household_income <= app.income_limit;
  const citizenshipOk = app.hoh_is_citizen || app.other_adult_citizen;

  y = labelValue(page, margin, y, 'Household Size', String(app.household_size), fontBold, fontReg);
  y = labelValue(page, margin, y, 'Bedroom Count', app.bedroom_count !== null ? `${app.bedroom_count} BR` : '—', fontBold, fontReg);
  y = labelValue(page, margin, y, 'Total Household Income', fmtCurrency(app.total_household_income), fontBold, fontReg);
  y = labelValue(page, margin, y, 'Income Limit', fmtCurrency(app.income_limit), fontBold, fontReg);
  y = labelValue(page, margin, y, 'Income Check', incomeOk ? 'Under Limit' : 'OVER LIMIT', fontBold, fontReg);
  y = labelValue(page, margin, y, 'Citizenship Check', citizenshipOk ? 'Met' : 'NOT MET', fontBold, fontReg);
  y = labelValue(page, margin, y, 'Overall Result', QUAL_LABELS[app.qualification_result] ?? app.qualification_result, fontBold, fontReg);
  y -= 10;

  // ── Citizenship Detail ─────────────────────────────────────────────────
  y = sectionHeading(page, margin, y, 'Citizenship', fontBold);
  y = labelValue(page, margin, y, 'HoH Citizen / Eligible', fmtBool(app.hoh_is_citizen), fontBold, fontReg);
  if (!app.hoh_is_citizen) {
    y = labelValue(
      page, margin, y,
      'Other Adult Eligible',
      app.other_adult_citizen === null ? '—' : fmtBool(app.other_adult_citizen),
      fontBold, fontReg,
    );
  }
  y -= 10;

  // ── Household Members ──────────────────────────────────────────────────
  y = sectionHeading(page, margin, y, `Household Members (${app.household_size})`, fontBold);

  // Column headers
  const colName = margin;
  const colRel = margin + 180;
  const colDob = margin + 270;
  const colIncome = margin + 370;

  page.drawText('Name', { x: colName, y, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Relationship', { x: colRel, y, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Date of Birth', { x: colDob, y, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Annual Income', { x: colIncome, y, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
  y -= 4;
  page.drawLine({ start: { x: margin, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 12;

  const members = app.household_members as HouseholdMember[];
  for (const m of members) {
    if (y < 80) {
      drawFooter(pdfDoc, page, fontReg, pageNum, margin);
      page = pdfDoc.addPage([612, 792]);
      pageNum++;
      drawFooter(pdfDoc, page, fontReg, pageNum, margin);
      y = 742;
    }
    const rel = m.relationship.charAt(0).toUpperCase() + m.relationship.slice(1);
    page.drawText(m.name, { x: colName, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(rel, { x: colRel, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(fmtDate(m.dob), { x: colDob, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(fmtCurrency(m.annual_income), { x: colIncome, y, size: 9, font: fontReg, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
    if (m.income_sources?.length > 0) {
      const srcLine = 'Income sources: ' + m.income_sources.join(', ');
      const wrapped = wrapText(srcLine, fontReg, 8, 460);
      for (const ln of wrapped) {
        if (y < 80) {
          drawFooter(pdfDoc, page, fontReg, pageNum, margin);
          page = pdfDoc.addPage([612, 792]);
          pageNum++;
          drawFooter(pdfDoc, page, fontReg, pageNum, margin);
          y = 742;
        }
        page.drawText(ln, { x: colName + 8, y, size: 8, font: fontReg, color: rgb(0.5, 0.5, 0.5) });
        y -= 11;
      }
    }
    y -= 4;
  }
  y -= 6;

  // ── Reviewer Decision ──────────────────────────────────────────────────
  if (y < 120) {
    drawFooter(pdfDoc, page, fontReg, pageNum, margin);
    page = pdfDoc.addPage([612, 792]);
    pageNum++;
    drawFooter(pdfDoc, page, fontReg, pageNum, margin);
    y = 742;
  }

  y = sectionHeading(page, margin, y, 'Reviewer Decision', fontBold);
  y = labelValue(page, margin, y, 'Review Status', REVIEW_LABELS[app.stanton_review_status] ?? app.stanton_review_status, fontBold, fontReg);
  y = labelValue(page, margin, y, 'Reviewer', app.stanton_reviewer ?? '—', fontBold, fontReg);
  y = labelValue(page, margin, y, 'Review Date', fmtDate(app.stanton_review_date), fontBold, fontReg);

  if (app.stanton_review_notes) {
    y -= 4;
    page.drawText('Notes:', { x: margin, y, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 13;
    const noteLines = wrapText(app.stanton_review_notes, fontReg, 9, 490);
    const noteResult = drawTextBlock(pdfDoc, page, noteLines, margin + 8, y, fontReg, 9, 13);
    page = noteResult.page;
    y = noteResult.y;
  }
  y -= 20;

  // ── Signature line ─────────────────────────────────────────────────────
  if (y < 80) {
    drawFooter(pdfDoc, page, fontReg, pageNum, margin);
    page = pdfDoc.addPage([612, 792]);
    pageNum++;
    drawFooter(pdfDoc, page, fontReg, pageNum, margin);
    y = 742;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: 562, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 20;
  page.drawText('Reviewer Signature: _______________________________', { x: margin, y, size: 10, font: fontReg, color: rgb(0.2, 0.2, 0.2) });
  page.drawText('Date: _______________', { x: 380, y, size: 10, font: fontReg, color: rgb(0.2, 0.2, 0.2) });

  return pdfDoc.save();
}
