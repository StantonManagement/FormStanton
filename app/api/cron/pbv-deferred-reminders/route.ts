/**
 * GET /api/cron/pbv-deferred-reminders
 *
 * Daily cron job for PBV deferred document reminders.
 * Sends reminders to tenants who have deferred documents or incomplete applications.
 * Implements anti-spam guardrails and cadence scheduling per PRD-43.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTenantNotification } from '@/lib/notifications/send';
import { NotificationType } from '@/lib/notifications/types';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

// Cadence schedule: days when reminders should be sent
const REMINDER_CADENCE_DAYS = [3, 7, 14, 21, 28, 35, 42];

// Helper to get tenant local time (defaults to America/New_York)
function getTenantLocalTime(date: Date, timezone?: string): Date {
  if (timezone && timezone !== 'America/New_York') {
    // Future: implement proper timezone handling when tenant_timezone column exists
    console.log(`[pbv-deferred-reminders] Using timezone ${timezone} (not yet implemented)`);
  }
  // Default to America/New_York (CT)
  return new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

// Helper to check if current time is during quiet hours (9pm-9am)
function isQuietHours(localTime: Date): boolean {
  const hour = localTime.getHours();
  return hour >= 21 || hour < 9;
}

// Helper to calculate next reminder date based on cadence
function getNextReminderDate(currentDay: number): Date | null {
  const nextDayIndex = REMINDER_CADENCE_DAYS.findIndex(day => day > currentDay);
  
  if (nextDayIndex === -1) {
    // No more reminders in cadence
    return null;
  }
  
  const nextDay = REMINDER_CADENCE_DAYS[nextDayIndex];
  const now = new Date();
  const daysUntilNext = nextDay - currentDay;
  
  const nextDate = new Date(now.getTime() + daysUntilNext * 24 * 60 * 60 * 1000);
  return nextDate;
}

// Helper to count missing documents for an application
async function getMissingDocsCount(applicationId: string): Promise<number> {
  const { data: docs, error } = await supabaseAdmin
    .from('application_documents')
    .select('status')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId)
    .eq('required', true);

  if (error || !docs) {
    console.error(`[pbv-deferred-reminders] Failed to count missing docs for ${applicationId}:`, error);
    return 0;
  }

  return docs.filter(doc => 
    doc.status === 'missing' || doc.status === 'deferred'
  ).length;
}

// Helper to check if tenant uploaded anything in last 24 hours
async function hasRecentUpload(applicationId: string): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: uploads, error } = await supabaseAdmin
    .from('application_documents')
    .select('updated_at')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId)
    .eq('status', 'submitted')
    .gte('updated_at', twentyFourHoursAgo)
    .limit(1);

  if (error) {
    console.error(`[pbv-deferred-reminders] Failed to check recent uploads for ${applicationId}:`, error);
    return false;
  }

  return (uploads?.length ?? 0) > 0;
}

// Helper to check if tenant exceeded weekly reminder limit
async function exceededWeeklyLimit(applicationId: string): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: notifications, error } = await supabaseAdmin
    .from('tenant_notifications')
    .select('id')
    .eq('application_id', applicationId)
    .eq('notification_type', 'docs_upload_reminder')
    .in('delivery_status', ['sent', 'sent_email_fallback'])
    .gte('sent_at', sevenDaysAgo);

  if (error) {
    console.error(`[pbv-deferred-reminders] Failed to check weekly limit for ${applicationId}:`, error);
    return false;
  }

  return (notifications?.length ?? 0) >= 2;
}

export async function GET(request: NextRequest) {
  const now = new Date();
  const nowIso = now.toISOString();
  
  console.log(`[pbv-deferred-reminders] Starting cron run at ${nowIso}`);

  try {
    // 1. Query applications due for reminders
    const { data: applications, error: fetchError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(`
        id,
        head_of_household_name,
        preferred_language,
        phone,
        next_reminder_scheduled_at,
        reminders_sent_count,
        intake_submitted_at,
        application_status,
        tenant_timezone
      `)
      .eq('intake_submitted', true)
      .neq('application_status', 'submitted')
      .lte('next_reminder_scheduled_at', nowIso)
      .not('next_reminder_scheduled_at', 'is', null);

    if (fetchError) {
      console.error('[pbv-deferred-reminders] Failed to fetch applications:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Database query failed' },
        { status: 500 }
      );
    }

    if (!applications || applications.length === 0) {
      console.log('[pbv-deferred-reminders] No applications due for reminders');
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[pbv-deferred-reminders] Found ${applications.length} applications to process`);

    let processed = 0;
    let sent = 0;
    let deferred = 0;
    let skipped = 0;

    for (const app of applications) {
      processed++;

      try {
        // 2. Guardrail: Check if application was submitted (double-check)
        if (app.application_status === 'submitted') {
          console.log(`[pbv-deferred-reminders] Skipping ${app.id} - already submitted`);
          skipped++;
          continue;
        }

        // 3. Guardrail: Check for recent uploads (engagement pause)
        const hasRecent = await hasRecentUpload(app.id);
        if (hasRecent) {
          console.log(`[pbv-deferred-reminders] Skipping ${app.id} - recent upload detected`);
          
          // Reschedule for next cycle
          const nextDate = getNextReminderDate(app.reminders_sent_count);
          if (nextDate) {
            await supabaseAdmin
              .from('pbv_full_applications')
              .update({
                next_reminder_scheduled_at: nextDate.toISOString(),
                updated_at: nowIso,
              })
              .eq('id', app.id);
          }
          
          skipped++;
          continue;
        }

        // 4. Guardrail: Check quiet hours
        const tenantLocalTime = getTenantLocalTime(now, app.tenant_timezone);
        if (isQuietHours(tenantLocalTime)) {
          console.log(`[pbv-deferred-reminders] Deferring ${app.id} - quiet hours (${tenantLocalTime.getHours()}:00)`);
          
          // Schedule for 9am tomorrow tenant local time
          const tomorrow9am = new Date(tenantLocalTime);
          tomorrow9am.setDate(tomorrow9am.getDate() + 1);
          tomorrow9am.setHours(9, 0, 0, 0);
          
          await supabaseAdmin
            .from('pbv_full_applications')
            .update({
              next_reminder_scheduled_at: tomorrow9am.toISOString(),
              updated_at: nowIso,
            })
            .eq('id', app.id);
            
          deferred++;
          continue;
        }

        // 5. Guardrail: Check weekly limit
        const exceededLimit = await exceededWeeklyLimit(app.id);
        if (exceededLimit) {
          console.log(`[pbv-deferred-reminders] Skipping ${app.id} - weekly limit exceeded`);
          skipped++;
          continue;
        }

        // 6. Get missing docs count
        const missingCount = await getMissingDocsCount(app.id);
        if (missingCount === 0) {
          console.log(`[pbv-deferred-reminders] Skipping ${app.id} - no missing docs`);
          
          // Clear reminder schedule
          await supabaseAdmin
            .from('pbv_full_applications')
            .update({
              next_reminder_scheduled_at: null,
              updated_at: nowIso,
            })
            .eq('id', app.id);
            
          skipped++;
          continue;
        }

        // 7. Send reminder
        const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/t/${app.id}`;
        const tenantName = app.head_of_household_name || 'there';
        const language = (app.preferred_language || 'en') as 'en' | 'es' | 'pt';

        const sendResult = await sendTenantNotification({
          applicationId: app.id,
          notificationType: NotificationType.DOCS_UPLOAD_REMINDER,
          interpolations: {
            tenant_name: tenantName,
            missing_count: missingCount.toString(),
            magic_link: magicLink,
          },
        });

        if (sendResult.status === 'sent' || sendResult.status === 'email_fallback') {
          console.log(`[pbv-deferred-reminders] Sent reminder to ${app.id} (${sendResult.status})`);
          sent++;

          // 8. Update reminder count and schedule next reminder
          const newCount = app.reminders_sent_count + 1;
          const nextDate = getNextReminderDate(newCount);

          if (nextDate) {
            await supabaseAdmin
              .from('pbv_full_applications')
              .update({
                reminders_sent_count: newCount,
                next_reminder_scheduled_at: nextDate.toISOString(),
                updated_at: nowIso,
              })
              .eq('id', app.id);
          } else {
            // Day 42 reached - final reminder, emit escalation event
            await supabaseAdmin
              .from('pbv_full_applications')
              .update({
                reminders_sent_count: newCount,
                next_reminder_scheduled_at: null, // No more reminders
                updated_at: nowIso,
              })
              .eq('id', app.id);

            // Emit staff escalation required event
            try {
              await writePbvApplicationEvent({
                applicationId: app.id,
                eventType: ApplicationEventType.STAFF_ESCALATION_REQUIRED,
                actorUserId: null,
                actorDisplayName: 'system',
                payload: {
                  reason: 'day_42_reminder_sent',
                  reminders_sent: newCount,
                  missing_docs_count: missingCount,
                },
              });
              console.log(`[pbv-deferred-reminders] Emitted staff escalation for ${app.id}`);
            } catch (eventError) {
              console.error(`[pbv-deferred-reminders] Failed to emit escalation event for ${app.id}:`, eventError);
            }
          }
        } else {
          console.log(`[pbv-deferred-reminders] Failed to send reminder to ${app.id}: ${sendResult.reason}`);
          skipped++;
        }

      } catch (appError) {
        console.error(`[pbv-deferred-reminders] Error processing application ${app.id}:`, appError);
        skipped++;
      }
    }

    const summary = {
      success: true,
      processed,
      sent,
      deferred,
      skipped,
      timestamp: nowIso,
    };

    console.log(`[pbv-deferred-reminders] Completed: ${JSON.stringify(summary)}`);
    return NextResponse.json(summary);

  } catch (error) {
    console.error('[pbv-deferred-reminders] Cron job failed:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
