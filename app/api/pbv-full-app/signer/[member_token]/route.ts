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

    const now = new Date();
    if (!member.magic_link_expires_at || new Date(member.magic_link_expires_at) < now) {
      return NextResponse.json({
        success: false,
        message: 'This link has expired.',
        code: 'expired',
      }, { status: 410 });
    }

    if (member.slot === 1) {
      return NextResponse.json({ success: false, message: 'HOH uses the primary token.' }, { status: 400 });
    }

    // Load HOH name from application
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('id', member.full_application_id)
      .maybeSingle();

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
