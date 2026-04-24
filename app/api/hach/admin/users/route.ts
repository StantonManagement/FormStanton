import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

async function requireHachAdmin() {
  const guard = await requireHachUser();
  if (guard) return { error: guard, user: null };
  const user = await getSessionUser();
  if (!user || user.user_type !== 'hach_admin') {
    return {
      error: NextResponse.json({ success: false, message: 'HACH admin access required' }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

/**
 * GET /api/hach/admin/users
 * Lists all HACH users and pending invitations.
 * Requires hach_admin.
 */
export async function GET() {
  const { error, user } = await requireHachAdmin();
  if (error) return error;

  try {
    const { data: users, error: usersErr } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, display_name, user_type, is_active, deactivated_at, last_login_at, created_at')
      .in('user_type', ['hach_admin', 'hach_reviewer'])
      .order('created_at', { ascending: false });

    if (usersErr) {
      return NextResponse.json({ success: false, message: usersErr.message }, { status: 500 });
    }

    const { data: pendingInvitations } = await supabaseAdmin
      .from('hach_user_invitations')
      .select('id, email, user_type, invited_by, expires_at, created_at')
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    const inviterIds = [
      ...new Set((pendingInvitations ?? []).map((i: any) => i.invited_by).filter(Boolean)),
    ];
    const inviterMap: Record<string, string> = {};
    if (inviterIds.length > 0) {
      const { data: inviters } = await supabaseAdmin
        .from('admin_users')
        .select('id, display_name')
        .in('id', inviterIds);
      for (const inv of inviters ?? []) {
        inviterMap[(inv as any).id] = (inv as any).display_name;
      }
    }

    const pendingWithInviter = (pendingInvitations ?? []).map((inv: any) => ({
      ...inv,
      invited_by_name: inviterMap[inv.invited_by] ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: { users: users ?? [], pending_invitations: pendingWithInviter },
    });
  } catch (err: any) {
    console.error('[hach/admin/users] GET error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hach/admin/users
 * Creates a HACH user invitation.
 * Requires hach_admin.
 */
export async function POST(request: NextRequest) {
  const { error, user } = await requireHachAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const { email, user_type } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ success: false, message: 'Valid email required' }, { status: 400 });
    }
    if (!user_type || !['hach_admin', 'hach_reviewer'].includes(user_type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid user_type — must be hach_admin or hach_reviewer' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('username', normalizedEmail)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: invErr } = await supabaseAdmin
      .from('hach_user_invitations')
      .insert({
        email: normalizedEmail,
        user_type,
        invited_by: user!.userId,
        token,
        expires_at: expiresAt,
      })
      .select('id, email, token, expires_at')
      .single();

    if (invErr) {
      return NextResponse.json({ success: false, message: invErr.message }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/hach/accept-invite?token=${token}`;
    console.log(`[HACH Invite URL] ${inviteUrl}`);

    await logAudit(user!, 'user.invited', 'hach_invitation', (invitation as any).id, {
      email: normalizedEmail,
      user_type,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data: {
        invitation_id: (invitation as any).id,
        email: (invitation as any).email,
        expires_at: (invitation as any).expires_at,
        invite_url: inviteUrl,
      },
    });
  } catch (err: any) {
    console.error('[hach/admin/users] POST error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
