/**
 * app/api/t/[token]/pbv-full-app/print/download/route.ts
 * GET handler: Returns signed application packet as PDF.
 * F7: Uses pdf-lib to merge signed form PDFs (serverless-safe, no Playwright).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PDFDocument } from 'pdf-lib';

interface PDFGenerationResult {
  pdf: Buffer;
  generationTimeMs: number;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
}

/**
 * F7: Generate signed packet by merging signed form PDFs using pdf-lib.
 * Serverless-safe: no browser launch required.
 */
async function generateSignedPacket(appId: string): Promise<PDFGenerationResult> {
  const startTime = Date.now();

  // Load signed form documents
  const { data: formDocs } = await supabaseAdmin
    .from('pbv_form_documents')
    .select('id, form_id, signed_pdf_path, status')
    .eq('full_application_id', appId)
    .eq('status', 'signed');

  // Load signed summary
  const { data: summaryDoc } = await supabaseAdmin
    .from('pbv_summary_documents')
    .select('id, pdf_storage_path')
    .eq('full_application_id', appId)
    .maybeSingle();

  // Create a new PDF for the packet
  const packetPdf = await PDFDocument.create();

  // Add cover page with packet info
  const coverPage = packetPdf.addPage();
  const { width, height } = coverPage.getSize();
  coverPage.drawText('PBV Application Packet', {
    x: 50,
    y: height - 100,
    size: 24,
  });
  coverPage.drawText(`Application ID: ${appId}`, {
    x: 50,
    y: height - 150,
    size: 12,
  });

  // Merge signed form PDFs
  for (const formDoc of (formDocs ?? [])) {
    if (!formDoc.signed_pdf_path) continue;

    const { data: pdfData, error } = await supabaseAdmin.storage
      .from('pbv-forms')
      .download(formDoc.signed_pdf_path);

    if (error || !pdfData) {
      console.warn(`[PDF Packet] Could not download ${formDoc.signed_pdf_path}:`, error);
      continue;
    }

    const pdfBytes = Buffer.from(await pdfData.arrayBuffer());
    const formPdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await packetPdf.copyPages(formPdf, formPdf.getPageIndices());
    copiedPages.forEach((page) => packetPdf.addPage(page));
  }

  // Merge summary PDF if available
  if (summaryDoc?.pdf_storage_path) {
    const { data: summaryData, error } = await supabaseAdmin.storage
      .from('pbv-forms')
      .download(summaryDoc.pdf_storage_path);

    if (!error && summaryData) {
      const summaryBytes = Buffer.from(await summaryData.arrayBuffer());
      const summaryPdf = await PDFDocument.load(summaryBytes);
      const copiedPages = await packetPdf.copyPages(summaryPdf, summaryPdf.getPageIndices());
      copiedPages.forEach((page) => packetPdf.addPage(page));
    }
  }

  const pdfBytes = await packetPdf.save();
  const generationTimeMs = Date.now() - startTime;

  return { pdf: Buffer.from(pdfBytes), generationTimeMs };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // Validate token and get application info
  const { data: app, error: appError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, intake_status, building_address')
    .eq('tenant_access_token', token)
    .maybeSingle();

  if (appError || !app) {
    return NextResponse.json(
      { success: false, message: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Only allow download when intake_status = 'complete'
  if (app.intake_status !== 'complete') {
    return NextResponse.json(
      { success: false, message: 'Application copy only available for completed applications' },
      { status: 403 }
    );
  }

  try {
    // F7: Generate signed packet using pdf-lib (serverless-safe)
    const { pdf, generationTimeMs } = await generateSignedPacket(app.id);

    // Build filename: <HOH lastname sanitized>-PBV-application-<YYYY-MM-DD>.pdf
    const hohName = app.head_of_household_name ?? 'Applicant';
    const lastName = hohName.split(' ').pop() ?? 'Applicant';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${sanitizeFilename(lastName)}-PBV-application-${date}.pdf`;

    console.log(`[PDF Download] Generated ${filename} for token ${token.substring(0, 8)}... in ${generationTimeMs}ms`);

    // Return PDF with appropriate headers
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length.toString(),
        'X-Generation-Time-Ms': generationTimeMs.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[PDF Download] Generation failed:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate PDF', error: error.message },
      { status: 500 }
    );
  }
}
