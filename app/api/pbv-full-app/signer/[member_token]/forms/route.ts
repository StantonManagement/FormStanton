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
      .select('id, form_id, display_name, language, status, generated_at, finalized_at, required_signer_count, collected_signer_count, conditional_trigger')
      .eq('full_application_id', member.full_application_id)
      .in('status', ['generated', 'signed', 'finalized']);

    if (error) throw error;

    // Determine which forms this member still needs to sign
    const signedFormIds = await (async () => {
      if (!docs || docs.length === 0) return new Set<string>();
      const formIds = docs.map((d) => d.id);
      const { data: events } = await supabaseAdmin
        .from('pbv_signature_events')
        .select('form_document_id')
        .eq('signer_member_id', member.id)
        .in('form_document_id', formIds);
      return new Set((events ?? []).map((e) => e.form_document_id));
    })();

    const forms = (docs ?? []).map((doc) => ({
      id: doc.id,
      form_id: doc.form_id,
      display_name: doc.display_name,
      language: doc.language,
      status: doc.status,
      generated_at: doc.generated_at,
      finalized_at: doc.finalized_at,
      required_signer_count: doc.required_signer_count,
      collected_signer_count: doc.collected_signer_count,
      signatures_complete: signedFormIds.has(doc.id),
      conditional_trigger: doc.conditional_trigger ?? null,
    }));

    return NextResponse.json({ success: true, data: { forms } });
  } catch (error: any) {
    console.error('[signer-forms] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
