import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/pbv/full-applications/[id]/lead
// Assign or unassign Application Lead
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: appId } = await params;
    const body = await request.json().catch(() => ({}));
    const { user_id: targetUserId }: { user_id: string | null } = body;

    // Fetch the application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, lead_user_id')
      .eq('id', appId)
      .single();

    if (appError || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const fromUserId = app.lead_user_id;

    // If assigning to a specific user, validate they exist and are active
    let targetUserName: string | null = null;
    if (targetUserId) {
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from('admin_users')
        .select('id, display_name, is_active')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        return NextResponse.json(
          { success: false, message: 'Target user not found' },
          { status: 400 }
        );
      }

      if (!targetUser.is_active) {
        return NextResponse.json(
          { success: false, message: 'Cannot assign to deactivated user' },
          { status: 400 }
        );
      }

      targetUserName = targetUser.display_name;
    }

    // Update the lead assignment
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        lead_user_id: targetUserId,
        lead_assigned_at: now,
        lead_assigned_by: sessionUser.userId,
      })
      .eq('id', appId);

    if (updateError) throw updateError;

    // Write the app_lead_assigned event
    await writePbvApplicationEvent({
      applicationId: appId,
      eventType: ApplicationEventType.APP_LEAD_ASSIGNED,
      actorUserId: sessionUser.userId,
      actorDisplayName: sessionUser.displayName,
      payload: {
        from_user_id: fromUserId,
        to_user_id: targetUserId,
        application_id: appId,
        head_of_household_name: app.head_of_household_name,
      },
    });

    // Post workspace message
    const messageBody = targetUserId
      ? `${sessionUser.displayName} assigned ${targetUserName} as Application Lead.`
      : `${sessionUser.displayName} removed Application Lead assignment.`;

    await supabaseAdmin.from('stanton_workspace_messages').insert({
      workspace_id: appId,
      author_user_id: null, // System message
      author_display_name: 'System',
      author_party_org: 'stanton',
      body: messageBody,
    });

    await logAudit(
      sessionUser,
      'application.lead_assigned',
      'pbv_full_applications',
      appId,
      { from_user_id: fromUserId, to_user_id: targetUserId },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        application_id: appId,
        lead_user_id: targetUserId,
        lead_assigned_at: now,
      },
    });
  } catch (error: any) {
    console.error('[lead] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
