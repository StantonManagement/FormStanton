/**
 * GET /api/t/[token]/pbv-full-app/forms/[form_document_id]/preview
 *
 * Serves the form PDF BYTES (signed if available, else unsigned) for inline
 * display in the review-and-sign <iframe>. Mirrors summary-pdf: returns raw
 * application/pdf so the same-origin iframe renders the document.
 *
 * Previously this returned JSON ({ data: { url } }) and the sign-form dialog
 * pointed its iframe straight at this endpoint, so tenants saw raw JSON instead
 * of the form (observed 2026-05-22). Pointing the iframe at the cross-origin
 * signed Supabase URL instead would also break under the enforced CSP
 * (`frame-src 'self'`), so we proxy the bytes same-origin — identical to how
 * summary-pdf already works (and middleware already serves this route
 * X-Frame-Options: SAMEORIGIN).
 *
 * Auth: tenant access_token → resolves to pbv_full_applications row.
 * Returns:
 *   200 + PDF bytes (Content-Type: application/pdf)
 *   404 if token invalid, doc not found, or PDF not generated/in storage
 *   500 on unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

    // Prefer the signed PDF once it exists; fall back to the unsigned source.
    const pdfPath = doc.signed_pdf_path ?? doc.unsigned_pdf_path;
    if (!pdfPath) {
      return NextResponse.json(
        { success: false, message: 'PDF not yet generated', code: 'not_generated' },
        { status: 404 }
      );
    }

    const { data: fileData, error: storageError } = await supabaseAdmin.storage
      .from('pbv-forms')
      .download(pdfPath);

    if (storageError || !fileData) {
      return NextResponse.json(
        { success: false, message: 'Form PDF not found in storage.', code: 'storage_missing' },
        { status: 404 }
      );
    }

    const bytes = await fileData.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="pbv-form-${doc.id}.pdf"`,
        // The same path serves the unsigned PDF before signing and the signed
        // PDF after; no-store avoids serving a stale unsigned copy post-sign.
        'Cache-Control': 'private, no-store',
        'X-Form-Signed': doc.signed_pdf_path ? 'true' : 'false',
      },
    });
  } catch (error: any) {
    console.error('[forms/preview] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
