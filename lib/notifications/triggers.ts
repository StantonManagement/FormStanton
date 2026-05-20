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
import { getPortalBaseUrl } from '@/lib/urls';

// Automatic SMS notifications DISABLED - all notifications are now staff-controlled
// Staff must explicitly click "Send SMS" buttons in the UI
// This prevents unexpected tenant notifications during complex cases
const eventToNotification: Partial<Record<string, NotificationType>> = {
  // All automatic sends removed per Phase 2 implementation
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

    // Automatic reminders DISABLED - staff must manually send reminders via UI
    // This prevents notification fatigue and gives staff control over timing
    // if (eventType === ApplicationEventType.APPLICATION_CREATED) {
    //   await scheduleReminders(applicationId);
    // }

    // Automatic HACH approval notification DISABLED - staff must manually notify
    // This allows staff to review packet before notifying tenant
    // if (eventType === ApplicationEventType.HANDOFF_SENT) {
    //   ... notification logic removed ...
    // }
  } catch (err) {
    console.error('[notifications/triggers] dispatch error:', err);
  }
}

async function buildInterpolations(
  applicationId: string,
  notificationType: NotificationType
): Promise<Record<string, string>> {
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
    // getPortalBaseUrl() throws if NEXT_PUBLIC_APP_URL is missing/malformed.
    // Surfacing that here is preferable to silently sending a non-tappable SMS.
    return { portal_url: `${getPortalBaseUrl()}/t/${token}` };
  }

  return {};
}
