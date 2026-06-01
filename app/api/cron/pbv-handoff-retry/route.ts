/**
 * GET /api/cron/pbv-handoff-retry
 *
 * PRD-85 Phase 1 — retry sweep for the intake→signing handoff.
 *
 * The `pbv_preflight_checklist` SMS sent at intake completion is the handoff
 * that links an applicant into signing. When it fails (e.g. a missing/late
 * template), intake completion is not blocked and the failure is recorded as an
 * `application_events` `notification.failed` row. This sweep re-attempts those
 * pending handoffs in the applicant's language, bounded to a max attempt count
 * over a 24h window with backoff (see lib/notifications/handoffRetry.ts). Each
 * attempt emits the existing notification.sent / notification.failed events via
 * sendTenantNotification.
 *
 * Handoffs that age out of the window (e.g. the Phase-4-gated backfill for Mia
 * and Santha) are intentionally NOT auto-retried here — they remain visible on
 * the operator surface for a manual resend.
 *
 * Protected by CRON_SECRET. Reuses the PRD-74 cron_run_locks lease.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTenantNotification } from '@/lib/notifications/send';
import { buildPreflightDocList } from '@/lib/notifications/buildPreflightDocList';
import { NotificationType } from '@/lib/notifications/types';
import { assertCronAuthorized } from '@/lib/cron/auth';
import { claimCronRun } from '@/lib/cron/runLock';
import {
  deriveHandoffState,
  evaluateHandoffRetry,
  type HandoffEvent,
} from '@/lib/notifications/handoffRetry';
import { isHandoffApproved } from '@/lib/pbv/preSendReview';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  // PRD-74 Phase 3: claim the run lease before doing work. Skip cleanly if a
  // parallel regional invocation already holds it.
  const acquired = await claimCronRun('pbv-handoff-retry', 300);
  if (!acquired) {
    console.log(JSON.stringify({ event: 'cron_skipped_locked', job: 'pbv-handoff-retry' }));
    return NextResponse.json({ success: true, skipped: true });
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  console.log(`[pbv-handoff-retry] Starting cron run at ${nowIso}`);

  try {
    // 1. Candidate apps: intake complete (a preflight handoff was due).
    const { data: apps, error: appsErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        'id, head_of_household_name, preferred_language, submission_language, tenant_access_token, intake_completed_at'
      )
      .eq('intake_status', 'complete');

    if (appsErr) {
      console.error('[pbv-handoff-retry] Failed to fetch applications:', appsErr);
      return NextResponse.json({ success: false, error: appsErr.message }, { status: 500 });
    }

    if (!apps || apps.length === 0) {
      console.log('[pbv-handoff-retry] No intake-complete applications');
      return NextResponse.json({ success: true, processed: 0 });
    }

    const appIds = apps.map((a) => a.id);

    // 2. Preflight handoff events for these apps (batch). Handoff state is
    //    derived from these — there is no handoff_status column.
    const { data: handoffEvents, error: eventsErr } = await supabaseAdmin
      .from('application_events')
      .select('anchor_id, event_type, payload, created_at')
      .eq('anchor_type', 'pbv_full_application')
      .in('anchor_id', appIds)
      .in('event_type', ['notification.sent', 'notification.failed']);

    if (eventsErr) {
      console.error('[pbv-handoff-retry] Failed to fetch events:', eventsErr);
      return NextResponse.json({ success: false, error: eventsErr.message }, { status: 500 });
    }

    const eventsByApp: Record<string, HandoffEvent[]> = {};
    for (const ev of handoffEvents ?? []) {
      (eventsByApp[ev.anchor_id] ??= []).push({
        event_type: ev.event_type,
        payload: ev.payload as HandoffEvent['payload'],
        created_at: ev.created_at,
      });
    }

    let eligible = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const app of apps) {
      const state = deriveHandoffState(eventsByApp[app.id] ?? []);
      const decision = evaluateHandoffRetry({
        now,
        state,
        intakeCompletedAt: app.intake_completed_at ?? null,
      });

      if (!decision.eligible) {
        skipped++;
        continue;
      }

      // PRD-87 gate: never auto-send a handoff whose package has not been
      // reviewed + approved at its current revision. Holds Mia/Santha (and any
      // un-reviewed app) out of the automatic sweep until an operator approves.
      if (!(await isHandoffApproved(app.id))) {
        skipped++;
        continue;
      }

      eligible++;

      try {
        // PRD-85: re-attempt in the applicant's language. resolveTenant (inside
        // sendTenantNotification) selects the template language; build the doc
        // list with the same preference so they agree.
        const language = (app.preferred_language ??
          app.submission_language ??
          'en') as 'en' | 'es' | 'pt';
        const docList = await buildPreflightDocList(app.id, language);
        const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/t/${app.tenant_access_token}`;
        const tenantName = app.head_of_household_name ?? 'there';

        const result = await sendTenantNotification({
          applicationId: app.id,
          notificationType: NotificationType.PBV_PREFLIGHT_CHECKLIST,
          interpolations: {
            tenant_name: tenantName,
            doc_list: docList.docListText,
            magic_link: magicLink,
          },
          triggeredByEventId: `handoff-retry-${app.id}-${nowIso}`,
        });

        if (result.status === 'sent' || result.status === 'email_fallback') {
          console.log(`[pbv-handoff-retry] Re-sent handoff for ${app.id} (${result.status})`);
          sent++;
        } else {
          console.warn(
            `[pbv-handoff-retry] Handoff retry not sent for ${app.id}: ${result.status}/${result.reason}`
          );
          failed++;
        }
      } catch (appErr) {
        console.error(`[pbv-handoff-retry] Error processing ${app.id}:`, appErr);
        failed++;
      }
    }

    const summary = {
      success: true,
      candidates: apps.length,
      eligible,
      sent,
      failed,
      skipped,
      timestamp: nowIso,
    };
    console.log(`[pbv-handoff-retry] Completed: ${JSON.stringify(summary)}`);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[pbv-handoff-retry] Cron job failed:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
