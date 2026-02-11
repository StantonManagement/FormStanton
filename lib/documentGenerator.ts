import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { PET_ADDENDUM, VEHICLE_ADDENDUM } from '@/lib/addendums';

// Helper: wrap text to fit within a given width
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { lines.push(''); continue; }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

// Helper: draw text block and return new Y position, adding pages as needed
function drawTextBlock(
  doc: PDFDocument,
  page: PDFPage,
  lines: string[],
  x: number,
  startY: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  color = rgb(0.1, 0.1, 0.1),
): { page: PDFPage; y: number } {
  let y = startY;
  let currentPage = page;
  for (const line of lines) {
    if (y < 50) {
      currentPage = doc.addPage([612, 792]);
      y = 742;
    }
    currentPage.drawText(line, { x, y, size: fontSize, font, color });
    y -= lineHeight;
  }
  return { page: currentPage, y };
}

export async function generatePetAddendumPdf(
  formData: any,
  petsArray: any[],
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Title
  page.drawText('PET ADDENDUM', { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;

  // Tenant info
  page.drawText(`Tenant: ${tenantName}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 14;
  page.drawText(`Building: ${building}  |  Unit: ${unit}  |  Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  // Addendum body text
  const bodyLines = wrapText(PET_ADDENDUM, fontRegular, 9, contentWidth);
  const result1 = drawTextBlock(pdfDoc, page, bodyLines, margin, y, fontRegular, 9, 12);
  page = result1.page;
  y = result1.y - 20;

  // Registered Pets section — highlighted
  if (y < 120) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawText('REGISTERED PETS:', { x: margin, y, size: 14, font: fontBold, color: rgb(0.0, 0.2, 0.5) });
  y -= 24;

  for (let i = 0; i < petsArray.length; i++) {
    const pet = petsArray[i];
    if (y < 140) { page = pdfDoc.addPage([612, 792]); y = 742; }

    // Pet header — larger distinct font
    const petLabel = `Pet #${i + 1}`;
    page.drawText(petLabel, { x: margin, y, size: 13, font: fontBold, color: rgb(0.0, 0.3, 0.6) });
    y -= 20;

    // Pet details — larger font to stand out
    const detailFont = fontBold;
    const detailSize = 12;
    const detailColor = rgb(0.0, 0.15, 0.4);
    const labelFont = fontRegular;
    const labelSize = 10;

    const fields = [
      { label: 'Type:', value: (pet.petType || pet.pet_type || '').toUpperCase() },
      { label: 'Name:', value: pet.petName || pet.pet_name || '' },
      { label: 'Breed:', value: pet.petBreed || pet.pet_breed || '' },
      { label: 'Weight:', value: `${pet.petWeight || pet.pet_weight || ''} lbs` },
      { label: 'Color:', value: pet.petColor || pet.pet_color || '' },
      { label: 'Spayed/Neutered:', value: (pet.petSpayed ?? pet.pet_spayed) ? 'Yes' : 'No' },
      { label: 'Vaccinations Current:', value: (pet.petVaccinationsCurrent ?? pet.pet_vaccinations_current) ? 'Yes' : 'No' },
    ];

    for (const f of fields) {
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
      page.drawText(`${f.label}`, { x: margin + 10, y, size: labelSize, font: labelFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(f.value, { x: margin + 140, y, size: detailSize, font: detailFont, color: detailColor });
      y -= 18;
    }
    y -= 10;
  }

  // Signature
  if (signatureBase64) {
    if (y < 100) { page = pdfDoc.addPage([612, 792]); y = 742; }
    y -= 10;
    page.drawText('Signature:', { x: margin, y, size: 10, font: fontBold });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 15;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  }

  return pdfDoc.save();
}

export async function generateNoPetsAddendumPdf(
  formData: any,
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  page.drawText('PET ADDENDUM — NO PETS', { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;
  page.drawText(`Tenant: ${tenantName}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 14;
  page.drawText(`Building: ${building}  |  Unit: ${unit}  |  Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  const bodyLines = wrapText(PET_ADDENDUM, fontRegular, 9, contentWidth);
  const result1 = drawTextBlock(pdfDoc, page, bodyLines, margin, y, fontRegular, 9, 12);
  page = result1.page;
  y = result1.y - 20;

  if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawText('TENANT CONFIRMS: NO PETS', { x: margin, y, size: 14, font: fontBold, color: rgb(0.5, 0.0, 0.0) });
  y -= 20;
  page.drawText('I confirm I do not have pets. I understand that if I get a pet, I must register it within 7 days.', { x: margin, y, size: 10, font: fontRegular });
  y -= 30;

  if (signatureBase64) {
    page.drawText('Signature:', { x: margin, y, size: 10, font: fontBold });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 15;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  }

  return pdfDoc.save();
}

export async function generateVehicleAddendumPdf(
  formData: any,
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  page.drawText('VEHICLE & PARKING ADDENDUM', { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;
  page.drawText(`Tenant: ${tenantName}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 14;
  page.drawText(`Building: ${building}  |  Unit: ${unit}  |  Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  const bodyLines = wrapText(VEHICLE_ADDENDUM, fontRegular, 9, contentWidth);
  const result1 = drawTextBlock(pdfDoc, page, bodyLines, margin, y, fontRegular, 9, 12);
  page = result1.page;
  y = result1.y - 20;

  // Vehicle details — highlighted
  if (y < 160) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawText('REGISTERED VEHICLE:', { x: margin, y, size: 14, font: fontBold, color: rgb(0.0, 0.2, 0.5) });
  y -= 24;

  const vehicleFields = [
    { label: 'Make:', value: formData.vehicleMake || formData.vehicle_make || '' },
    { label: 'Model:', value: formData.vehicleModel || formData.vehicle_model || '' },
    { label: 'Year:', value: String(formData.vehicleYear || formData.vehicle_year || '') },
    { label: 'Color:', value: formData.vehicleColor || formData.vehicle_color || '' },
    { label: 'License Plate:', value: formData.vehiclePlate || formData.vehicle_plate || '' },
  ];

  for (const f of vehicleFields) {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText(`${f.label}`, { x: margin + 10, y, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(f.value, { x: margin + 140, y, size: 12, font: fontBold, color: rgb(0.0, 0.15, 0.4) });
    y -= 18;
  }
  y -= 20;

  if (signatureBase64) {
    if (y < 100) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText('Signature:', { x: margin, y, size: 10, font: fontBold });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 15;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  }

  return pdfDoc.save();
}

// Legacy exports kept for backward compatibility — these are no longer used
export function prepareTemplateData(formData: any, signatureBase64?: string, signatureDate?: string) {
  return { tenant_name: formData.fullName || formData.full_name };
}
export function preparePetTemplateData(formData: any, signatureBase64?: string, signatureDate?: string) {
  return prepareTemplateData(formData, signatureBase64, signatureDate);
}
export function prepareVehicleTemplateData(formData: any, signatureBase64?: string, signatureDate?: string) {
  return prepareTemplateData(formData, signatureBase64, signatureDate);
}
export async function generateDocument(templateName: string, data: any): Promise<Buffer> {
  return Buffer.from([]);
}
