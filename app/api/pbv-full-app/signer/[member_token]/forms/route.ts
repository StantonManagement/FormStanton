/**
 * GET /api/pbv-full-app/signer/[member_token]/forms
 *
 * Returns the list of pbv_form_documents this member needs to sign.
 * Scoped to forms where:
 *   - the form belongs to this application
 *   - the member is in required_signer_member_ids (or required_signer_count > collected)
 *
 * Auth: member_token expiry checked. Returns 410 if expired.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { mapSignerForms } from '@/lib/pbv/signer-forms-mapping';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ member_token: string }> }
) {
  try {
    const { member_token } = await context.params;

    const { data: member } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, full_application_id, magic_link_expires_at')
      .eq('magic_link_token', member_token)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ success: false, message: 'Link not found.' }, { status: 404 });
    }

    if (!member.magic_link_expires_at || new Date(member.magic_link_expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'This link has expired.', code: 'expired' }, { status: 410 });
    }

    const { data: docs, error } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, form_id, language, status, generated_at, finalized_at, required_signer_member_ids, collected_signer_member_ids, conditional_trigger')
      .eq('full_application_id', member.full_application_id)
      .in('status', ['generated', 'signed', 'finalized']);

    if (error) throw error;

    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('preferred_language')
      .eq('id', member.full_application_id)
      .maybeSingle();

    const formIds = [...new Set((docs ?? []).map((d) => d.form_id))];
    const { data: templates } = await supabaseAdmin
      .from('pbv_form_templates')
      .select('form_id, display_name_en, display_name_es')
      .in('form_id', formIds.length > 0 ? formIds : ['__none__']);

    const signedFormIds = await (async () => {
      if (!docs || docs.length === 0) return new Set<string>();
      const docIds = docs.map((d) => d.id);
      const { data: events } = await supabaseAdmin
        .from('pbv_signature_events')
        .select('form_document_id')
        .eq('signer_member_id', member.id)
        .in('form_document_id', docIds);
      return new Set((events ?? []).map((e) => e.form_document_id));
    })();

    const forms = mapSignerForms({
      docs: docs ?? [],
      templates: templates ?? [],
      preferredLanguage: app?.preferred_language ?? null,
      signedFormIds,
    });

    return NextResponse.json({ success: true, data: { forms } });
  } catch (error: any) {
    console.error('[signer-forms] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
