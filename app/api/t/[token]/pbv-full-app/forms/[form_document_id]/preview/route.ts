/**
 * GET /api/t/[token]/pbv-full-app/forms/[form_document_id]/preview
 *
 * Returns a signed URL for previewing the form PDF (unsigned or signed).
 * Prefers the signed_pdf_path if available, otherwise unsigned_pdf_path.
 * URL expires in 60 seconds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string; form_document_id: string }> }
) {
  try {
    const { token, form_document_id } = await context.params;

    // Resolve token → application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    // Load form document and verify it belongs to this application
    const { data: doc, error: docError } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, unsigned_pdf_path, signed_pdf_path, status')
      .eq('id', form_document_id)
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (docError) throw docError;
    if (!doc) {
      return NextResponse.json({ success: false, message: 'Form document not found' }, { status: 404 });
    }

    const pdfPath = doc.signed_pdf_path ?? doc.unsigned_pdf_path;
    if (!pdfPath) {
      return NextResponse.json({ success: false, message: 'PDF not yet generated' }, { status: 404 });
    }

    const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
      .from('pbv-forms')
      .createSignedUrl(pdfPath, 60);

    if (urlError || !signedUrlData?.signedUrl) {
      throw urlError ?? new Error('Failed to create signed URL');
    }

    return NextResponse.json({
      success: true,
      data: {
        url: signedUrlData.signedUrl,
        expires_in_seconds: 60,
        status: doc.status,
        is_signed: !!doc.signed_pdf_path,
      },
    });
  } catch (error: any) {
    console.error('[forms/preview] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
