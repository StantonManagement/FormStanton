/**
 * GET /api/pbv-full-app/signer/[member_token]
 *
 * Bootstrap endpoint for a non-HOH adult's magic-link signing session.
 * Auth: member_token (from pbv_household_members.magic_link_token).
 *
 * Returns:
 *   - member info: id, name, slot, preferred_language
 *   - application context: hoh_name
 *   - expiry check: 410 if expired
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isMagicLinkExpired } from '@/lib/pbv/magicLinkExpiry';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ member_token: string }> }
) {
  try {
    const { member_token } = await context.params;

    const { data: member, error: memberError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, age, signature_required, magic_link_token, magic_link_expires_at, full_application_id, preferred_language')
      .eq('magic_link_token', member_token)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      return NextResponse.json({ success: false, message: 'Link not found.', code: 'not_found' }, { status: 404 });
    }

    // PRD-78 #8: centralized epoch-based expiry check (fail-closed on null/
    // unparseable). magic_link_expires_at is TIMESTAMPTZ per migration
    // 20260515000000_pbv_form_execution_columns.sql:68, so Date.parse()
    // round-trips as a UTC instant.
    if (isMagicLinkExpired(member.magic_link_expires_at)) {
      return NextResponse.json({
        success: false,
        message: 'This link has expired.',
        code: 'expired',
      }, { status: 410 });
    }

    if (member.slot === 1) {
      return NextResponse.json({ success: false, message: 'HOH uses the primary token.' }, { status: 400 });
    }

    // PRD-82 #A4: packet_locked gate. PRD-77 added this in withTenantContext
    // for the tenant lane, but the magic-link lane resolves the application
    // from the member token and never flowed through that wrapper. Without
    // this check, a non-HOH adult on a magic link could keep viewing forms
    // and signing after staff sent the packet to HACH review.
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked')
      .eq('id', member.full_application_id)
      .maybeSingle();

    if (app?.packet_locked) {
      return NextResponse.json(
        {
          success: false,
          message: 'This packet is currently under review. Please contact the Stanton office.',
          code: 'packet_locked',
        },
        { status: 409 }
      );
    }

    let hohName = '';
    if (app) {
      const { data: hoh } = await supabaseAdmin
        .from('pbv_household_members')
        .select('name')
        .eq('full_application_id', app.id)
        .eq('slot', 1)
        .maybeSingle();
      hohName = hoh?.name ?? '';
    }

    return NextResponse.json({
      success: true,
      data: {
        member_id: member.id,
        member_name: member.name,
        slot: member.slot,
        age: member.age,
        preferred_language: member.preferred_language ?? 'en',
        hoh_name: hohName,
        application_id: member.full_application_id,
        magic_link_expires_at: member.magic_link_expires_at,
      },
    });
  } catch (error: any) {
    console.error('[signer-bootstrap] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
