/**
 * app/api/t/[token]/pbv-full-app/print/download/route.ts
 * GET handler: Returns application copy as PDF.
 * Renders the print view HTML and converts to PDF using Playwright.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

interface PDFGenerationResult {
  pdf: Buffer;
  generationTimeMs: number;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);
}

async function generatePDFFromURL(url: string): Promise<PDFGenerationResult> {
  const startTime = Date.now();
  
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to the print view
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for content to render
    await page.waitForSelector('.print-container', { timeout: 10000 });

    // Generate PDF
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '0.75in',
        bottom: '0.75in',
        left: '0.75in',
        right: '0.75in',
      },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>', // Empty header
      footerTemplate: `
        <div style="font-size: 9pt; font-family: Inter, sans-serif; width: 100%; text-align: center; color: #718096; padding: 0 0.5in;">
          Page <span class="pageNumber"></span> of <span class="totalPages"></span>
        </div>
      `,
    });

    const generationTimeMs = Date.now() - startTime;

    // Log if generation took too long
    if (generationTimeMs > 10000) {
      console.warn(`[PDF Generation] Slow generation: ${generationTimeMs}ms for ${url}`);
    }

    return { pdf, generationTimeMs };
  } finally {
    await browser.close();
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // Get the base URL for the print view
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const printViewUrl = `${baseUrl}/pbv-full-app/${token}/print`;

  // Use withTenantContext to validate token and get application info
  // We need to check manually since we need to validate before PDF generation
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
    // Generate PDF from print view
    const { pdf, generationTimeMs } = await generatePDFFromURL(printViewUrl);

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
