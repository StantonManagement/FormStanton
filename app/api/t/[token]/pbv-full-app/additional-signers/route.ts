/**
 * GET /api/t/[token]/pbv-full-app/additional-signers
 *
 * Returns household members who still need to sign, along with
 * their magic_link_token if one has been generated.
 * Excludes the HOH (slot=1) since they are the primary signer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    // Load non-HOH adults who have signature_required
    const { data: members, error: membersError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, age, signature_required, magic_link_token, magic_link_expires_at, signing_device')
      .eq('full_application_id', app.id)
      .eq('signature_required', true)
      .gt('slot', 1)
      .order('slot', { ascending: true });

    if (membersError) throw membersError;

    // F3: Per-form has_signed check
    // Load form documents to see which members are required signers
    const memberIds = (members ?? []).map((m) => m.id);
    const { data: formDocs } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, required_signer_member_ids')
      .eq('full_application_id', app.id)
      .not('status', 'eq', 'skipped');

    // L10: completion is sourced from pbv_signature_events (the source of
    // truth), not the cached collected_signer_member_ids array. The cache is
    // written AFTER the signature event row (completeForm.ts), so reading the
    // cache could under-report a signer who has actually signed, and any drift
    // between the array and the events table would surface as a wrong status.
    const formDocIds = (formDocs ?? []).map((f) => f.id);
    const { data: sigEvents } = await supabaseAdmin
      .from('pbv_signature_events')
      .select('form_document_id, signer_member_id')
      .in('form_document_id', formDocIds.length > 0 ? formDocIds : ['__none__']);

    const signedSet = new Set<string>();
    for (const ev of (sigEvents ?? [])) {
      signedSet.add(`${ev.form_document_id}:${ev.signer_member_id}`);
    }

    // Build a map: member_id -> { requiredForms, signedForms }
    const memberFormStatus = new Map<string, { required: number; signed: number }>();
    for (const memberId of memberIds) {
      memberFormStatus.set(memberId, { required: 0, signed: 0 });
    }

    for (const formDoc of (formDocs ?? [])) {
      const requiredIds: string[] = formDoc.required_signer_member_ids ?? [];

      for (const memberId of memberIds) {
        if (requiredIds.includes(memberId)) {
          const status = memberFormStatus.get(memberId)!;
          status.required++;
          if (signedSet.has(`${formDoc.id}:${memberId}`)) {
            status.signed++;
          }
        }
      }
    }

    // F3: has_signed = true only if all required forms are signed (or no forms required)
    const signers = (members ?? []).map((m) => {
      const status = memberFormStatus.get(m.id)!;
      const has_signed = status.required === 0 || status.signed >= status.required;

      return {
        member_id: m.id,
        slot: m.slot,
        name: m.name,
        age: m.age,
        has_signed,
        forms_required: status.required,
        forms_signed: status.signed,
        magic_link_generated: !!m.magic_link_token,
        magic_link_expires_at: m.magic_link_expires_at ?? null,
        signing_device: m.signing_device ?? 'unknown',
      };
    });

    const pending_count = signers.filter((s) => !s.has_signed).length;

    return NextResponse.json({
      success: true,
      data: { signers, pending_count },
    });
  } catch (error: any) {
    console.error('[additional-signers] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
