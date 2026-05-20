/**
 * GET /api/cron/notifications/scheduled-sends
 *
 * Vercel cron endpoint (hourly). Reads due notification_schedules rows,
 * evaluates cancel_predicate, dispatches sendTenantNotification or cancels.
 *
 * Protected by CRON_SECRET header — set CRON_SECRET in env.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTenantNotification } from '@/lib/notifications/send';
import { resolvePredicate } from '@/lib/notifications/predicates';
import { initNotificationTriggers } from '@/lib/notifications/init';
import type { NotificationType } from '@/lib/notifications/types';

initNotificationTriggers();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date().toISOString();

  const { data: dueRows, error } = await supabaseAdmin
    .from('notification_schedules')
    .select('id, application_id, notification_type, cancel_predicate, interpolations')
    .eq('status', 'pending')
    .lte('due_at', now)
    .limit(100);

  if (error) {
    console.error('[cron/scheduled-sends] query error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueRows || dueRows.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const row of dueRows) {
    try {
      // Evaluate cancel predicate
      if (row.cancel_predicate) {
        const predicate = resolvePredicate(row.cancel_predicate);
        if (predicate) {
          const shouldCancel = await predicate(row.application_id);
          if (shouldCancel) {
            await supabaseAdmin
              .from('notification_schedules')
              .update({ status: 'cancelled' })
              .eq('id', row.id);
            cancelled++;
            continue;
          }
        }
      }

      const interpolations = (row.interpolations as Record<string, string> | null) ?? {};

      // Build portal_url if not already in interpolations snapshot
      if (!interpolations.portal_url) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        const { data: app } = await supabaseAdmin
          .from('pbv_full_applications')
          .select('tenant_access_token')
          .eq('id', row.application_id)
          .maybeSingle();
        if (app?.tenant_access_token) {
          interpolations.portal_url = `${appUrl}/t/${app.tenant_access_token}`;
        }
      }

      const result = await sendTenantNotification({
        applicationId: row.application_id,
        notificationType: row.notification_type as NotificationType,
        interpolations,
      });

      const newStatus = result.status === 'sent' ? 'sent' : 'failed';
      await supabaseAdmin
        .from('notification_schedules')
        .update({ status: newStatus, sent_at: new Date().toISOString() })
        .eq('id', row.id);

      if (result.status === 'sent') sent++;
      else failed++;
    } catch (err) {
      console.error('[cron/scheduled-sends] row error:', err);
      await supabaseAdmin
        .from('notification_schedules')
        .update({ status: 'failed' })
        .eq('id', row.id);
      failed++;
    }
  }

  return NextResponse.json({ processed: dueRows.length, sent, cancelled, failed });
}
