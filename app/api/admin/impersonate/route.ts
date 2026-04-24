import { NextRequest, NextResponse } from 'next/server';
import { getSession, getRealSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

// POST /api/admin/impersonate  — super admin starts viewing as another user
export async function POST(request: NextRequest) {
  try {
    const real = await getRealSessionUser();
    if (!real) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!real.isSuperAdmin) {
      return NextResponse.json(
        { success: false, message: 'Only super admins can impersonate other users' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const targetUserId = typeof body?.userId === 'string' ? body.userId : null;
    if (!targetUserId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    }

    if (targetUserId === real.userId) {
      return NextResponse.json(
        { success: false, message: 'Cannot impersonate yourself' },
        { status: 400 }
      );
    }

    const { data: target } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, display_name, is_active, is_super_admin')
      .eq('id', targetUserId)
      .single();

    if (!target) {
      return NextResponse.json({ success: false, message: 'Target user not found' }, { status: 404 });
    }
    if (!target.is_active) {
      return NextResponse.json(
        { success: false, message: 'Target user is inactive' },
        { status: 400 }
      );
    }
    if (target.is_super_admin) {
      return NextResponse.json(
        { success: false, message: 'Cannot impersonate another super admin' },
        { status: 403 }
      );
    }

    const session = await getSession();
    const startedAt = new Date().toISOString();
    session.impersonating = { userId: target.id, startedAt };
    await session.save();

    await logAudit(
      real,
      'impersonation.start',
      'admin_user',
      target.id,
      { targetUsername: target.username, targetDisplayName: target.display_name, startedAt },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        userId: target.id,
        username: target.username,
        displayName: target.display_name,
        startedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message ?? 'Failed to start impersonation' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/impersonate — exit View As, return to real identity
export async function DELETE(request: NextRequest) {
  try {
    const real = await getRealSessionUser();
    if (!real) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const session = await getSession();
    const was = session.impersonating;
    if (!was) {
      return NextResponse.json({ success: true }); // nothing to do
    }

    session.impersonating = undefined;
    await session.save();

    const durationMs = was.startedAt ? Date.now() - new Date(was.startedAt).getTime() : null;

    await logAudit(
      real,
      'impersonation.stop',
      'admin_user',
      was.userId,
      { startedAt: was.startedAt, durationMs },
      getClientIp(request)
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message ?? 'Failed to stop impersonation' },
      { status: 500 }
    );
  }
}
