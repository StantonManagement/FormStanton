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

    // Check which have completed signing via pbv_signature_events
    const memberIds = (members ?? []).map((m) => m.id);
    const { data: events } = await supabaseAdmin
      .from('pbv_signature_events')
      .select('signer_member_id')
      .in('signer_member_id', memberIds.length > 0 ? memberIds : ['__none__']);

    const signedMemberIds = new Set((events ?? []).map((e) => e.signer_member_id));

    const signers = (members ?? []).map((m) => ({
      member_id: m.id,
      slot: m.slot,
      name: m.name,
      age: m.age,
      has_signed: signedMemberIds.has(m.id),
      magic_link_generated: !!m.magic_link_token,
      magic_link_expires_at: m.magic_link_expires_at ?? null,
      signing_device: m.signing_device ?? 'unknown',
    }));

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
