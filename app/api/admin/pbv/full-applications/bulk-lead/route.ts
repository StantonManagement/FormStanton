import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

interface BulkLeadResult {
  id: string;
  ok: boolean;
  reason?: string;
}

// POST /api/admin/pbv/full-applications/bulk-lead
// Bulk assign Application Lead to multiple applications
export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      application_ids: appIds,
      user_id: targetUserId,
    }: { application_ids: string[]; user_id: string | null } = body;

    if (!Array.isArray(appIds) || appIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'application_ids array is required' },
        { status: 400 }
      );
    }

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

    // Fetch all applications
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, lead_user_id')
      .in('id', appIds);

    if (appsError) throw appsError;

    const appMap = new Map(apps?.map((a) => [a.id, a]) ?? []);

    // Process each application
    const results: BulkLeadResult[] = [];
    const now = new Date().toISOString();

    for (const appId of appIds) {
      const app = appMap.get(appId);
      if (!app) {
        results.push({ id: appId, ok: false, reason: 'Application not found' });
        continue;
      }

      const fromUserId = app.lead_user_id;

      // Update the lead assignment
      const { error: updateError } = await supabaseAdmin
        .from('pbv_full_applications')
        .update({
          lead_user_id: targetUserId,
          lead_assigned_at: now,
          lead_assigned_by: sessionUser.userId,
        })
        .eq('id', appId);

      if (updateError) {
        results.push({ id: appId, ok: false, reason: updateError.message });
        continue;
      }

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

      results.push({ id: appId, ok: true });
    }

    // Post summary workspace messages
    const appsUpdated = results.filter((r) => r.ok).map((r) => appMap.get(r.id)!);
    const uniqueAppNames = [...new Set(appsUpdated.map((a) => a.head_of_household_name))];

    for (const app of appsUpdated) {
      const messageBody = targetUserId
        ? `${sessionUser.displayName} assigned ${targetUserName} as Application Lead (${app.head_of_household_name}).`
        : `${sessionUser.displayName} removed Application Lead assignment (${app.head_of_household_name}).`;

      await supabaseAdmin.from('stanton_workspace_messages').insert({
        workspace_id: app.id,
        author_user_id: null,
        author_display_name: 'System',
        author_party_org: 'stanton',
        body: messageBody,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: appIds.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        applications_updated: uniqueAppNames,
      },
    });
  } catch (error: any) {
    console.error('[bulk-lead] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
