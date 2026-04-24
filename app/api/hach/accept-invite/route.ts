import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession, loadUserPermissions } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * GET /api/hach/accept-invite?token=X
 * Validates an invitation token. Public — no auth required.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
  }

  try {
    const { data: invitation, error } = await supabaseAdmin
      .from('hach_user_invitations')
      .select('id, email, user_type, expires_at, accepted_at')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json(
        { success: false, message: 'Invalid or unknown invitation token' },
        { status: 404 }
      );
    }

    if ((invitation as any).accepted_at) {
      return NextResponse.json(
        { success: false, message: 'This invitation has already been used' },
        { status: 410 }
      );
    }

    if (new Date((invitation as any).expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'This invitation has expired — contact a HACH admin for a new one' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        email: (invitation as any).email,
        user_type: (invitation as any).user_type,
        expires_at: (invitation as any).expires_at,
      },
    });
  } catch (err: any) {
    console.error('[hach/accept-invite] GET error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/hach/accept-invite
 * Creates a HACH user account from a valid invitation. Public — no auth required.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, display_name, password } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 2) {
      return NextResponse.json(
        { success: false, message: 'Full name is required (minimum 2 characters)' },
        { status: 400 }
      );
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, message: 'Password is required' }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 12 characters' },
        { status: 400 }
      );
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { success: false, message: 'Password must include at least one letter and one number' },
        { status: 400 }
      );
    }

    const { data: invitation, error: invErr } = await supabaseAdmin
      .from('hach_user_invitations')
      .select('id, email, user_type, expires_at, accepted_at')
      .eq('token', token)
      .single();

    if (invErr || !invitation) {
      return NextResponse.json({ success: false, message: 'Invalid invitation token' }, { status: 404 });
    }
    if ((invitation as any).accepted_at) {
      return NextResponse.json({ success: false, message: 'Invitation already used' }, { status: 410 });
    }
    if (new Date((invitation as any).expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'Invitation has expired' }, { status: 410 });
    }

    const email = (invitation as any).email as string;
    const user_type = (invitation as any).user_type as string;

    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('username', email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { data: newUser, error: createErr } = await supabaseAdmin
      .from('admin_users')
      .insert({
        username: email,
        display_name: display_name.trim(),
        password_hash,
        role: 'staff',
        is_active: true,
        user_type,
        created_by: 'hach_invite',
      })
      .select('id, username, display_name, user_type')
      .single();

    if (createErr || !newUser) {
      console.error('[accept-invite] create user error:', createErr);
      return NextResponse.json({ success: false, message: 'Failed to create account' }, { status: 500 });
    }

    await supabaseAdmin
      .from('hach_user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    const userId = (newUser as any).id;
    const { permissions, departmentId, departmentCode, isSuperAdmin } = await loadUserPermissions(userId);

    const session = await getSession();
    session.isAdmin = true;
    session.userId = userId;
    session.username = (newUser as any).username;
    session.displayName = (newUser as any).display_name;
    session.departmentId = departmentId;
    session.departmentCode = departmentCode;
    session.permissions = permissions;
    session.isSuperAdmin = isSuperAdmin;
    session.user_type = user_type;
    session.impersonating = undefined;
    await session.save();

    await logAudit(
      {
        userId,
        username: (newUser as any).username,
        displayName: (newUser as any).display_name,
        departmentId: null,
        departmentCode: null,
        permissions,
        isSuperAdmin: false,
        user_type,
      },
      'user.account_created',
      'admin_user',
      userId,
      { method: 'invitation', user_type },
      getClientIp(request)
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[hach/accept-invite] POST error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
