/**
 * POST /api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link
 *
 * Generates and stores a magic_link_token for a non-HOH adult member.
 * The token expires 30 days from generation.
 *
 * Idempotent: if a valid (non-expired) token already exists, returns it.
 * If expired, regenerates.
 *
 * Note: SMS sending is out of scope for PRD-24; this endpoint only
 * stores the token. The notification is triggered by the caller (UI).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string; member_id: string }> }
) {
  try {
    const { token, member_id } = await context.params;

    // Resolve HOH application via token
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, submitted_at')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    if (app.submitted_at) {
      return NextResponse.json(
        { success: false, message: 'Application already submitted', code: 'submitted_locked' },
        { status: 409 }
      );
    }

    // Verify member belongs to this application and is a non-HOH adult
    const { data: member, error: memberError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, signature_required, magic_link_token, magic_link_expires_at')
      .eq('id', member_id)
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      return NextResponse.json({ success: false, message: 'Member not found' }, { status: 404 });
    }

    if (member.slot === 1) {
      return NextResponse.json(
        { success: false, message: 'HOH uses the primary token, not a magic link' },
        { status: 400 }
      );
    }

    if (!member.signature_required) {
      return NextResponse.json(
        { success: false, message: 'This member does not require a signature' },
        { status: 400 }
      );
    }

    // Idempotent: return existing non-expired token
    const now = new Date();
    if (
      member.magic_link_token &&
      member.magic_link_expires_at &&
      new Date(member.magic_link_expires_at) > now
    ) {
      return NextResponse.json({
        success: true,
        data: {
          member_id: member.id,
          member_name: member.name,
          magic_link_token: member.magic_link_token,
          magic_link_expires_at: member.magic_link_expires_at,
          regenerated: false,
        },
      });
    }

    // Generate new token
    const newToken = generateToken();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('pbv_household_members')
      .update({
        magic_link_token: newToken,
        magic_link_expires_at: expiresAt,
      })
      .eq('id', member.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: {
        member_id: member.id,
        member_name: member.name,
        magic_link_token: newToken,
        magic_link_expires_at: expiresAt,
        regenerated: true,
      },
    });
  } catch (error: any) {
    console.error('[additional-signers/send-link] POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
