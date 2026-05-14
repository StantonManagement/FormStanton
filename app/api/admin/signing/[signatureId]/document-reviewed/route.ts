/**
 * Admin/Staff Signing - Document Review API
 * POST: Records that signer reviewed all pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { loadCaptureState, recordDocumentReviewed } from '@/lib/signing/capture/capture-state';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ signatureId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.stateId || typeof body.pagesViewed !== 'number' || typeof body.pdfPageCount !== 'number') {
      return NextResponse.json(
        { success: false, message: 'pagesViewed and pdfPageCount are required' },
        { status: 400 }
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

    // Get the original PDF path
    const { data: sig } = await supabaseAdmin
      .from('packet_signatures')
      .select('signed_pdf_path, signing_packets!inner(application_id)')
      .eq('id', signatureId)
      .single();

    const packet = sig?.signing_packets as unknown as { application_id: string } | undefined;
    const originalPdfPath = sig?.signed_pdf_path?.replace('_signed', '_original') || 
      `signing-packets/${packet?.application_id || 'unknown'}/${signatureId}/original.pdf`;

    // Record document review
    await recordDocumentReviewed(
      state.id,
      body.pagesViewed,
      body.pdfPageCount,
      originalPdfPath,
      body.originalPdfHash || 'pending'
    );

    return NextResponse.json({
      success: true,
      data: {
        nextStep: 'signature',
      },
    });
  } catch (error: any) {
    console.error('Admin document review POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
