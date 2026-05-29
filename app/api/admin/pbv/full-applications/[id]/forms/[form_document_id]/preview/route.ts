/**
 * GET /api/admin/pbv/full-applications/[id]/forms/[form_document_id]/preview
 *
 * Admin-facing preview of a generated PBV form PDF. Streams the PDF bytes
 * (signed if available, else the unsigned filled source) so staff can review
 * the field-mapping output before any signature is applied and re-review the
 * signed copy afterward.
 *
 * Auth: admin session (isAuthenticated). Mirrors the tenant preview route
 * (app/api/t/[token]/pbv-full-app/forms/[form_document_id]/preview) minus the
 * token resolution — the application id comes from the route param instead.
 *
 * Returns:
 *   200 + PDF bytes (Content-Type: application/pdf)
 *   401 if not authenticated
 *   404 if app/doc not found or PDF not generated/in storage
 *   500 on unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; form_document_id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, form_document_id } = await context.params;

    // Load form document and verify it belongs to this application
    const { data: doc, error: docError } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, unsigned_pdf_path, signed_pdf_path, status')
      .eq('id', form_document_id)
      .eq('full_application_id', id)
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
        'Cache-Control': 'private, no-store',
        'X-Form-Signed': doc.signed_pdf_path ? 'true' : 'false',
      },
    });
  } catch (error: any) {
    console.error('[admin/forms/preview] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
