/**
 * GET /api/t/[token]/pbv-full-app/summary-pdf
 *
 * Serves the unsigned summary PDF for display in the PRD-26 review-and-sign UI.
 * Returns raw PDF bytes — bypasses withTenantContext (which wraps output in JSON).
 *
 * Auth: tenant access_token → resolves to pbv_full_applications row.
 * Returns:
 *   200 + PDF bytes  (Content-Type: application/pdf)
 *   404 if token invalid or summary not generated yet
 *   500 on unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const { data: summaryDoc, error } = await supabaseAdmin
      .from('pbv_summary_documents')
      .select('pdf_storage_path, language, template_version, signed_at')
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (error) throw error;

    if (!summaryDoc?.pdf_storage_path) {
      return NextResponse.json(
        { success: false, message: 'Summary not yet generated. Call generate-forms first.', code: 'not_generated' },
        { status: 404 }
      );
    }

    const { data: fileData, error: storageError } = await supabaseAdmin.storage
      .from('pbv-forms')
      .download(summaryDoc.pdf_storage_path);

    if (storageError || !fileData) {
      return NextResponse.json(
        { success: false, message: 'Summary PDF not found in storage.', code: 'storage_missing' },
        { status: 404 }
      );
    }

    const bytes = await fileData.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="pbv-summary-${summaryDoc.language}.pdf"`,
        'Cache-Control': 'private, max-age=300',
        'X-Summary-Template-Version': summaryDoc.template_version,
        'X-Summary-Signed': summaryDoc.signed_at ? 'true' : 'false',
      },
    });
  } catch (err: any) {
    console.error('[summary-pdf] GET error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
