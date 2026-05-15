/**
 * POST /api/admin/pbv/full-applications/[id]/send-sms
 *
 * Staff-controlled SMS sending for full application invitations.
 * Requires authentication. Does not auto-send - staff must explicitly trigger.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTenantNotification } from '@/lib/notifications/send';
import { NotificationType } from '@/lib/notifications/types';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth check
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await context.params;

    // 2. Parse body
    const body = await request.json().catch(() => null);
    if (!body || !body.notification_type) {
      return NextResponse.json(
        { success: false, message: 'notification_type is required' },
        { status: 400 }
      );
    }

    const { notification_type } = body as { notification_type: NotificationType };

    // 3. Validate notification type
    const allowedTypes: NotificationType[] = [
      'magic_link_initial',
      'magic_link_resent',
      'doc_rejected',
      'hach_approved_signing_ready',
      'hap_executed_move_in',
      'docs_upload_reminder',
    ];
    if (!allowedTypes.includes(notification_type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid notification_type' },
        { status: 400 }
      );
    }

    // 4. Fetch application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, tenant_access_token, head_of_household_name, phone, preferred_language')
      .eq('id', applicationId)
      .single();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    // Validate phone number exists
    if (!app.phone) {
      return NextResponse.json(
        { success: false, message: 'Application has no phone number on file' },
        { status: 400 }
      );
    }

    // 5. Send notification via unified send primitive
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const portalUrl = `${appUrl}/t/${app.tenant_access_token}`;

    const result = await sendTenantNotification({
      applicationId,
      notificationType: notification_type,
      interpolations: { portal_url: portalUrl },
    });

    // 6. Audit log
    await logAudit(
      user,
      'pbv_full_application.send_sms',
      'pbv_full_applications',
      applicationId,
      {
        notification_type,
        result_status: result.status,
        notification_id: result.notificationId,
        sent_by_staff: true,
      },
      getClientIp(request)
    );

    // 7. Return result
    if (result.status === 'sent') {
      return NextResponse.json({
        success: true,
        data: {
          notification_id: result.notificationId,
          twilio_sid: result.twilioSid,
        },
      });
    }

    if (result.status === 'blocked') {
      return NextResponse.json(
        {
          success: false,
          message: `SMS blocked: ${result.reason}`,
          reason: result.reason,
        },
        { status: 400 }
      );
    }

    if (result.status === 'email_fallback') {
      return NextResponse.json({
        success: true,
        data: {
          notification_id: result.notificationId,
          email_sent: result.emailSent,
          note: 'SMS failed, sent via email fallback',
        },
      });
    }

    // Failed
    return NextResponse.json(
      {
        success: false,
        message: result.reason || 'Failed to send notification',
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('[send-sms] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
