/**
 * Tenant Signing - Document Review API
 * POST: Records that signer reviewed all pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { loadCaptureState, recordDocumentReviewed } from '@/lib/signing/capture/capture-state';
import { computeSha256 } from '@/lib/signing/capture/hash';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; signatureId: string }> }
) {
  try {
    const { token, signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.stateId || typeof body.pagesViewed !== 'number' || typeof body.pdfPageCount !== 'number') {
      return NextResponse.json(
        { success: false, message: 'pagesViewed and pdfPageCount are required' },
        { status: 400 }
      );
    }

    // Verify tenant token
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Load state
    const state = await loadCaptureState(body.stateId);
    if (!state) {
      return NextResponse.json(
        { success: false, message: 'Session expired. Please start over.' },
        { status: 400 }
      );
    }

    if (state.step !== 'review') {
      return NextResponse.json(
        { success: false, message: `Invalid step: ${state.step}` },
        { status: 400 }
      );
    }

    // Verify all pages were viewed
    if (body.pagesViewed < body.pdfPageCount) {
      return NextResponse.json(
        { 
          success: false, 
          message: `You must view all pages before signing. Viewed: ${body.pagesViewed}, Total: ${body.pdfPageCount}`,
          pagesViewed: body.pagesViewed,
          pdfPageCount: body.pdfPageCount,
        },
        { status: 400 }
      );
    }

    // Get the original PDF path from packet_signatures
    const { data: sig } = await supabaseAdmin
      .from('packet_signatures')
      .select('signed_pdf_path')
      .eq('id', signatureId)
      .single();

    // Note: In the actual implementation, the original PDF would be stored 
    // at a path like: {application_id}/{signature_id}/original.pdf
    // For now, we'll use a placeholder path pattern
    const originalPdfPath = sig?.signed_pdf_path?.replace('_signed', '_original') || 
      `signing-packets/${app.id}/${signatureId}/original.pdf`;

    // Hash the original PDF (we would load it from storage here)
    // For now, we'll store a placeholder that gets filled at apply time
    const originalPdfHash = body.originalPdfHash || 'pending';

    // Record document review
    await recordDocumentReviewed(
      state.id,
      body.pagesViewed,
      body.pdfPageCount,
      originalPdfPath,
      originalPdfHash
    );

    return NextResponse.json({
      success: true,
      data: {
        nextStep: 'signature',
      },
    });
  } catch (error: any) {
    console.error('Tenant document review POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
