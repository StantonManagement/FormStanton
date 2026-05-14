/**
 * triggers.ts
 *
 * Declarative mapping: ApplicationEventType → NotificationType (or null).
 * Imported by the subscriber registered in application-events.ts at startup.
 *
 * Entries with null mean the event is acknowledged but no direct notification
 * is sent (e.g. handoff.sent requires a payload predicate check handled below).
 */

import { ApplicationEventType } from '@/lib/events/application-events';
import { NotificationType } from './types';
import { sendTenantNotification } from './send';
import { scheduleReminders } from './scheduler';
import { supabaseAdmin } from '@/lib/supabase';

const eventToNotification: Partial<Record<string, NotificationType>> = {
  [ApplicationEventType.APPLICATION_CREATED]:  NotificationType.MAGIC_LINK_INITIAL,
  [ApplicationEventType.DOCUMENT_REJECTED]:    NotificationType.DOC_REJECTED,
  [ApplicationEventType.HAP_EXECUTED]:         NotificationType.HAP_EXECUTED_MOVE_IN,
};

/**
 * dispatchNotificationTrigger
 *
 * Called fire-and-forget from writePbvApplicationEvent after the event commits.
 * Never throws. Failures are logged and emitted as notification.failed events.
 */
export async function dispatchNotificationTrigger(
  eventType: string,
  applicationId: string,
  eventId: string
): Promise<void> {
  try {
    const notificationType = eventToNotification[eventType];

    if (notificationType) {
      const interpolations = await buildInterpolations(applicationId, notificationType);
      await sendTenantNotification({
        applicationId,
        notificationType,
        interpolations,
        triggeredByEventId: eventId,
      });
    }

    // Special case: APPLICATION_CREATED → schedule upload reminders
    if (eventType === ApplicationEventType.APPLICATION_CREATED) {
      await scheduleReminders(applicationId);
    }

    // Special case: handoff.sent with hach_review_status === 'approved_by_hach'
    if (eventType === ApplicationEventType.HANDOFF_SENT) {
      const { data: event } = await supabaseAdmin
        .from('application_events')
        .select('payload')
        .eq('id', eventId)
        .maybeSingle();
      const payload = event?.payload as { hach_review_status?: string } | null;
      if (payload?.hach_review_status === 'approved_by_hach') {
        const interpolations = await buildInterpolations(applicationId, NotificationType.HACH_APPROVED_SIGNING_READY);
        await sendTenantNotification({
          applicationId,
          notificationType: NotificationType.HACH_APPROVED_SIGNING_READY,
          interpolations,
          triggeredByEventId: eventId,
        });
      }
    }
  } catch (err) {
    console.error('[notifications/triggers] dispatch error:', err);
  }
}

async function buildInterpolations(
  applicationId: string,
  notificationType: NotificationType
): Promise<Record<string, string>> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  if (
    notificationType === NotificationType.MAGIC_LINK_INITIAL ||
    notificationType === NotificationType.MAGIC_LINK_RESENT ||
    notificationType === NotificationType.DOCS_UPLOAD_REMINDER ||
    notificationType === NotificationType.HACH_APPROVED_SIGNING_READY ||
    notificationType === NotificationType.SIGNING_REMINDER
  ) {
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('tenant_access_token')
      .eq('id', applicationId)
      .maybeSingle();
    const token = app?.tenant_access_token ?? '';
    return { portal_url: `${appUrl}/t/${token}` };
  }

  return {};
}
