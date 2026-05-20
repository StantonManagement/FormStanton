/**
 * POST   /api/admin/pbv/full-applications/[id]/assisted-session
 *   Body: {}
 *   Starts a staff-assisted session for this application.
 *   Sets session.assistedMode with the calling staff user's identity.
 *   Returns the tenant portal URL for the application.
 *
 * DELETE /api/admin/pbv/full-applications/[id]/assisted-session
 *   Ends the active assisted session.
 *
 * Auth: any authenticated admin staff member (not super-admin-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, getRealSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await getRealSessionUser();
    if (!staff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await context.params;

    // Verify application exists
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, tenant_access_token')
      .eq('id', applicationId)
      .maybeSingle();

    if (!app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const session = await getSession();
    const startedAt = new Date().toISOString();

    session.assistedMode = {
      staffUserId: staff.userId,
      staffDisplayName: staff.displayName,
      applicationId,
      startedAt,
    };
    await session.save();

    await logAudit(
      staff,
      'pbv_assisted.start',
      'pbv_full_application',
      applicationId,
      {
        staffDisplayName: staff.displayName,
        hohName: app.head_of_household_name,
        startedAt,
      },
      getClientIp(request)
    );

    const tenantUrl = `/pbv-full-app/${(app as any).tenant_access_token}`;

    return NextResponse.json({
      success: true,
      data: {
        applicationId,
        staffUserId: staff.userId,
        staffDisplayName: staff.displayName,
        startedAt,
        tenantUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message ?? 'Failed to start assisted session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await getRealSessionUser();
    if (!staff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await context.params;

    const session = await getSession();
    const was = session.assistedMode;

    if (!was) {
      return NextResponse.json({ success: true, data: { already_ended: true } });
    }

    const durationMs = was.startedAt ? Date.now() - new Date(was.startedAt).getTime() : null;
    session.assistedMode = undefined;
    await session.save();

    await logAudit(
      staff,
      'pbv_assisted.end',
      'pbv_full_application',
      applicationId,
      { startedAt: was.startedAt, durationMs },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: { durationMs } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message ?? 'Failed to end assisted session' },
      { status: 500 }
    );
  }
}
