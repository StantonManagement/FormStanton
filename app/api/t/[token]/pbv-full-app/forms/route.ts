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

    const forms = (docs ?? []).map((doc) => {
      const tmpl = templateMap[doc.form_id];
      // L8: display the name in the language the form was actually generated
      // in (doc.language, set from submission_language at generation time),
      // not the tenant's current preferred_language. Those can differ, which
      // previously showed a form's name in a different language than its body.
      const docLang = doc.language ?? app.preferred_language ?? 'en';
      const displayName =
        docLang === 'pt'
          ? (tmpl?.display_name_pt ?? tmpl?.display_name_en ?? doc.form_id)
          : docLang === 'es'
            ? (tmpl?.display_name_es ?? doc.form_id)
            : (tmpl?.display_name_en ?? doc.form_id);

      const requiredCount = (doc.required_signer_member_ids ?? []).length;
      const collectedCount = (doc.collected_signer_member_ids ?? []).length;
      // PRP-023: harden the L5 guard. The pre-PRP-023 rule was
      // `collected >= required`, which silently treats a row with
      // required=[] / collected=[] as complete. Combined with the
      // generate-forms bug that left required_signer_member_ids=[] on real
      // federal forms, this let unsigned forms pass canSubmit. Use the
      // canonical pbv_form_documents.status the signing flow sets when all
      // signers complete, and accept 'skipped' for conditionally-excluded
      // forms. (collected >= required > 0) is kept only as a defensive
      // bridge while the migration backfill rolls out.
      const signedByStatus = doc.status === 'signed' || doc.status === 'finalized' || doc.status === 'skipped';
      const signedByCount = requiredCount > 0 && collectedCount >= requiredCount;

      return {
        id: doc.id,
        form_id: doc.form_id,
        display_name: displayName,
        language: doc.language,
        status: doc.status,
        generated_at: doc.generated_at,
        finalized_at: doc.finalized_at,
        required_signer_count: requiredCount,
        collected_signer_count: collectedCount,
        signatures_complete: signedByStatus || signedByCount,
        conditional_trigger: doc.conditional_trigger ?? null,
      };
    });

    return NextResponse.json({ success: true, data: { forms } });
  } catch (error: any) {
    console.error('[forms] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
