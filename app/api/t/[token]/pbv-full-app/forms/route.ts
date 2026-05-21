/**
 * GET /api/t/[token]/pbv-full-app/forms
 *
 * Returns all generated form documents for this application.
 * Includes per-form status, required vs collected signers, and display names.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    // Resolve token → application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, submission_language, preferred_language')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    // Load form documents
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, form_id, language, status, generated_at, finalized_at, required_signer_member_ids, collected_signer_member_ids, conditional_trigger')
      .eq('full_application_id', app.id)
      .order('form_id', { ascending: true });

    if (docsError) throw docsError;

    // Load form template display names
    const formIds = [...new Set((docs ?? []).map((d) => d.form_id))];
    const { data: templates } = await supabaseAdmin
      .from('pbv_form_templates')
      .select('form_id, display_name_en, display_name_es, display_name_pt')
      .in('form_id', formIds.length > 0 ? formIds : ['__none__']);

    const templateMap = Object.fromEntries(
      (templates ?? []).map((t) => [t.form_id, t])
    );

    const lang = app.preferred_language ?? 'en';

    const forms = (docs ?? []).map((doc) => {
      const tmpl = templateMap[doc.form_id];
      const displayName =
        lang === 'pt'
          ? (tmpl?.display_name_pt ?? tmpl?.display_name_en ?? doc.form_id)
          : lang === 'es'
            ? (tmpl?.display_name_es ?? doc.form_id)
            : (tmpl?.display_name_en ?? doc.form_id);

      return {
        id: doc.id,
        form_id: doc.form_id,
        display_name: displayName,
        language: doc.language,
        status: doc.status,
        generated_at: doc.generated_at,
        finalized_at: doc.finalized_at,
        required_signer_count: (doc.required_signer_member_ids ?? []).length,
        collected_signer_count: (doc.collected_signer_member_ids ?? []).length,
        signatures_complete:
          (doc.required_signer_member_ids ?? []).length > 0 &&
          (doc.collected_signer_member_ids ?? []).length >=
            (doc.required_signer_member_ids ?? []).length,
        conditional_trigger: doc.conditional_trigger ?? null,
      };
    });

    return NextResponse.json({ success: true, data: { forms } });
  } catch (error: any) {
    console.error('[forms] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
