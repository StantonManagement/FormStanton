/**
 * POST /api/admin/notifications/bulk-send
 *
 * Permission-gated bulk SMS send.
 * Body: {
 *   notification_type: NotificationType,
 *   filter: { project_id?: string, application_ids?: string[], application_status?: string },
 *   dry_run?: boolean
 * }
 *
 * dry_run=true  → returns resolved application list + opt-out summary, zero Twilio calls.
 * dry_run=false → emits bulk_send_initiated event, fans out sendTenantNotification per app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { sendTenantNotification } from '@/lib/notifications/send';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { initNotificationTriggers } from '@/lib/notifications/init';
import type { NotificationType } from '@/lib/notifications/types';

initNotificationTriggers();

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const canBulkSend =
    sessionUser.isSuperAdmin ||
    sessionUser.permissions.some(
      (p) => p.resource === 'notifications' && p.action === 'bulk_send'
    );

  if (!canBulkSend) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
  }

  const { notification_type, filter = {}, dry_run = false } = body as {
    notification_type: NotificationType;
    filter: { project_id?: string; application_ids?: string[]; application_status?: string };
    dry_run?: boolean;
  };

  if (!notification_type) {
    return NextResponse.json({ success: false, message: 'notification_type is required' }, { status: 400 });
  }

  // Resolve matching applications
  let query = supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, phone, sms_opted_out_at, stanton_review_status, tenant_access_token');

  if (filter.application_ids?.length) {
    query = query.in('id', filter.application_ids);
  }
  if (filter.application_status) {
    query = query.eq('stanton_review_status', filter.application_status);
  }

  const { data: apps, error: appsErr } = await query;

  if (appsErr) {
    return NextResponse.json({ success: false, message: appsErr.message }, { status: 500 });
  }

  const allApps = apps ?? [];
  const optedOut = allApps.filter((a) => a.sms_opted_out_at != null);
  const eligible = allApps.filter((a) => a.sms_opted_out_at == null);

  if (dry_run) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      total: allApps.length,
      eligible: eligible.length,
      opted_out: optedOut.length,
      applications: eligible.map((a) => ({
        id: a.id,
        name: a.head_of_household_name,
        phone: a.phone,
        status: a.stanton_review_status,
      })),
    });
  }

  // Wet run — emit bulk_send_initiated then fan out
  const bulkSendId = crypto.randomUUID();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  try {
    await writePbvApplicationEvent({
      applicationId: eligible[0]?.id ?? 'bulk',
      eventType: ApplicationEventType.NOTIFICATION_SENT,
      actorUserId: sessionUser.userId,
      actorDisplayName: sessionUser.displayName,
      payload: {
        notification_type,
        notification_id: bulkSendId,
        twilio_message_sid: '',
        bulk_send_id: bulkSendId,
      },
    });
  } catch {
    // non-fatal
  }

  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (const app of eligible) {
    try {
      const interpolations: Record<string, string> = {};
      if (app.tenant_access_token) {
        interpolations.portal_url = `${appUrl}/t/${app.tenant_access_token}`;
      }

      const result = await sendTenantNotification({
        applicationId: app.id,
        notificationType: notification_type,
        interpolations,
        bulkSendId,
      });

      if (result.status === 'sent') sent++;
      else if (result.status === 'blocked') blocked++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    dry_run: false,
    bulk_send_id: bulkSendId,
    total: allApps.length,
    sent,
    blocked,
    failed,
    opted_out_skipped: optedOut.length,
  });
}
