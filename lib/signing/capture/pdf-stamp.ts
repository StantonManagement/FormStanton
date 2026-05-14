/**
 * pdf-stamp.ts
 * 
 * Server-side PDF stamping using pdf-lib.
 * Applies signature stamp with signer name, signature image, date, and audit ID.
 */

import { PDFDocument, PDFPage, RGB, rgb, StandardFonts } from 'pdf-lib';
import { computeSha256, computeSha256FromDataUrl } from './hash';

export interface StampParams {
  signerName: string;
  signatureImageDataUrl: string;
  date: string;
  auditId: string;
  consentVersion: string;
}

export interface StampResult {
  pdfBytes: Uint8Array;
  originalHash: string;
  signedHash: string;
}

/**
 * Load a PDF from storage buffer and apply signature stamp.
 */
export async function stampPdf(
  originalPdfBuffer: Buffer,
  params: StampParams
): Promise<StampResult> {
  // Hash original
  const originalHash = computeSha256(originalPdfBuffer);

  // Load PDF
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  // Embed signature image
  const signatureImage = await embedSignatureImage(pdfDoc, params.signatureImageDataUrl);

  // Apply stamp to last page
  await applyStampToPage(lastPage, signatureImage, params, pdfDoc);

  // Save and hash
  const pdfBytes = await pdfDoc.save();
  const signedHash = computeSha256(Buffer.from(pdfBytes));

  return {
    pdfBytes,
    originalHash,
    signedHash,
  };
}

/**
 * Embed the signature image into the PDF document.
 */
async function embedSignatureImage(
  pdfDoc: PDFDocument,
  dataUrl: string
): Promise<{ image: any; width: number; height: number }> {
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid signature image data URL');
  }

  const imageBuffer = Buffer.from(base64Data, 'base64');

  // Try PNG first, then JPEG
  try {
    const image = await pdfDoc.embedPng(imageBuffer);
    return { image, width: image.width, height: image.height };
  } catch {
    try {
      const image = await pdfDoc.embedJpg(imageBuffer);
      return { image, width: image.width, height: image.height };
    } catch {
      throw new Error('Signature image must be PNG or JPEG format');
    }
  }
}

/**
 * Apply the signature stamp to a PDF page.
 */
async function applyStampToPage(
  page: PDFPage,
  signatureImage: { image: any; width: number; height: number },
  params: StampParams,
  pdfDoc: PDFDocument
): Promise<void> {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  
  // Stamp dimensions
  const stampWidth = 400;
  const stampHeight = 120;
  const margin = 50;
  
  // Position at bottom center of page
  const x = (pageWidth - stampWidth) / 2;
  const y = margin;

  // Draw border
  page.drawRectangle({
    x,
    y,
    width: stampWidth,
    height: stampHeight,
    borderColor: rgb(0.3, 0.3, 0.3),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  // Draw signature image (scaled to fit)
  const maxSigWidth = 150;
  const maxSigHeight = 60;
  const scale = Math.min(
    maxSigWidth / signatureImage.width,
    maxSigHeight / signatureImage.height,
    1
  );
  const sigWidth = signatureImage.width * scale;
  const sigHeight = signatureImage.height * scale;

  page.drawImage(signatureImage.image, {
    x: x + 10,
    y: y + stampHeight - sigHeight - 10,
    width: sigWidth,
    height: sigHeight,
  });

  // Draw text
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Signer name
  page.drawText(params.signerName, {
    x: x + 170,
    y: y + stampHeight - 25,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Date
  page.drawText(`Date: ${params.date}`, {
    x: x + 170,
    y: y + stampHeight - 45,
    size: 10,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Disclosure text
  page.drawText('Electronically signed under ESIGN Act', {
    x: x + 170,
    y: y + stampHeight - 65,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Audit ID (small, for verification)
  page.drawText(`Audit: ${params.auditId.slice(0, 8)}...`, {
    x: x + 170,
    y: y + 10,
    size: 7,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Consent version
  page.drawText(params.consentVersion, {
    x: x + 10,
    y: y + 10,
    size: 7,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

/**
 * Verify that a PDF buffer matches an expected hash.
 */
export function verifyPdfIntegrity(
  pdfBuffer: Buffer,
  expectedHash: string
): boolean {
  const actualHash = computeSha256(pdfBuffer);
  return actualHash === expectedHash;
}
