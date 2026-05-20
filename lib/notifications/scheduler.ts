/**
 * scheduler.ts
 *
 * Inserts notification_schedules rows for reminder sends.
 * Called by the trigger dispatcher after APPLICATION_CREATED.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { NotificationType } from './types';

/**
 * Schedule three docs_upload_reminder rows at +3d, +7d, +14d after now.
 */
export async function scheduleReminders(applicationId: string): Promise<void> {
  const now = new Date();
  const rows = [3, 7, 14].map((days) => {
    const dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      application_id: applicationId,
      notification_type: NotificationType.DOCS_UPLOAD_REMINDER,
      due_at: dueAt.toISOString(),
      cancel_predicate: 'all_docs_uploaded',
      status: 'pending',
      interpolations: {},
    };
  });

  const { error } = await supabaseAdmin
    .from('notification_schedules')
    .insert(rows);

  if (error) {
    console.error('[notifications/scheduler] failed to insert schedules:', error);
    return;
  }

  for (const row of rows) {
    try {
      await writePbvApplicationEvent({
        applicationId,
        eventType: ApplicationEventType.NOTIFICATION_SCHEDULED,
        actorUserId: null,
        actorDisplayName: 'system',
        payload: {
          notification_type: row.notification_type,
          due_at: row.due_at,
          cancel_predicate: row.cancel_predicate,
        },
      });
    } catch (err) {
      console.error('[notifications/scheduler] failed to emit scheduled event:', err);
    }
  }
}
