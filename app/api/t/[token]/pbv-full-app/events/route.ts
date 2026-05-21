/**
 * POST /api/t/[token]/pbv-full-app/events
 *
 * Client-side analytics event ingestion for the document card stack (PRD-42 F7).
 * Batches events from useCardAnalytics hook and writes to application_events.
 *
 * Events accepted:
 * - DOCUMENT_CARD_VIEWED
 * - DOCUMENT_CARD_COMPLETED
 * - DOCUMENT_CARD_DEFERRED
 * - DOCUMENT_CARD_SKIPPED
 * - DOCUMENT_CARD_DEACTIVATED
 * - DOCUMENT_HELP_OPENED
 * - DOCUMENT_SCANNER_OPENED
 * - DOCUMENT_SCANNER_RETAKE
 * - DOCUMENT_UPLOAD_SUCCESS
 * - DOCUMENT_UPLOAD_FAILED
 * - DOCUMENT_STACK_STARTED
 * - DOCUMENT_SIDESHEET_OPENED
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

// Valid event types from PRD-42 F7
const VALID_EVENT_TYPES = new Set([
  'DOCUMENT_CARD_VIEWED',
  'DOCUMENT_CARD_COMPLETED',
  'DOCUMENT_CARD_DEFERRED',
  'DOCUMENT_CARD_SKIPPED',
  'DOCUMENT_CARD_DEACTIVATED',
  'DOCUMENT_HELP_OPENED',
  'DOCUMENT_SCANNER_OPENED',
  'DOCUMENT_SCANNER_RETAKE',
  'DOCUMENT_UPLOAD_SUCCESS',
  'DOCUMENT_UPLOAD_FAILED',
  'DOCUMENT_STACK_STARTED',
  'DOCUMENT_SIDESHEET_OPENED',
]);

interface ClientEvent {
  event_type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Resolve token to application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) {
      console.error('[pbv-full-app/events] Error resolving token:', appError);
      return NextResponse.json(
        { success: false, message: 'Failed to resolve token' },
        { status: 500 }
      );
    }

    if (!app) {
      return NextResponse.json(
        { success: false, message: 'Not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let body: { application_id?: string; events?: ClientEvent[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body.events || !Array.isArray(body.events)) {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid events array' },
        { status: 400 }
      );
    }

    // Validate and process events
    const results: Array<{ event_type: string; status: 'accepted' | 'rejected'; error?: string }> = [];
    const processedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

    for (const event of body.events) {
      // Validate event type
      if (!VALID_EVENT_TYPES.has(event.event_type)) {
        results.push({
          event_type: event.event_type,
          status: 'rejected',
          error: 'Invalid event type',
        });
        continue;
      }

      // Validate payload is object
      if (!event.payload || typeof event.payload !== 'object') {
        results.push({
          event_type: event.event_type,
          status: 'rejected',
          error: 'Invalid payload',
        });
        continue;
      }

      results.push({ event_type: event.event_type, status: 'accepted' });
      processedEvents.push({
        eventType: `document_card.${event.event_type.toLowerCase().replace('document_', '')}`,
        payload: {
          ...event.payload,
          client_timestamp: event.timestamp,
          original_event_type: event.event_type,
        },
      });
    }

    // Write events to application_events table (fire-and-forget, don't block response)
    // Use Promise.allSettled to handle individual failures gracefully
    const writePromises = processedEvents.map(async ({ eventType, payload }) => {
      try {
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: eventType as any, // Cast to valid event type
          actorUserId: null, // Tenant is anonymous via token
          actorDisplayName: app.head_of_household_name || 'Tenant',
          payload: payload as any,
        });
        return { success: true, eventType };
      } catch (err) {
        console.error(`[pbv-full-app/events] Failed to write ${eventType}:`, err);
        return { success: false, eventType, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });

    // Don't await - fire and forget to not block UX
    Promise.allSettled(writePromises).then((results) => {
      const failures = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
      if (failures.length > 0) {
        console.warn(`[pbv-full-app/events] ${failures.length} events failed to persist`);
      }
    });

    // PRD-84 #A8: surface persistence status. Pre-PRD-84 the writes ran
    // fire-and-forget (Promise.allSettled without await) and the response
    // gave the client no way to tell whether the events actually got
    // written. Default posture is async-non-blocking — the route's role
    // is analytics ingestion, not authoritative persistence, so adding
    // 50–100ms to the tenant request path to await the writes is the
    // wrong trade. Instead we tell the client how many writes were
    // INITIATED. A future change can flip to `await Promise.allSettled`
    // and report settled results if a downstream consumer ever needs
    // confirmed persistence.
    return NextResponse.json({
      success: true,
      data: {
        accepted: results.filter((r) => r.status === 'accepted').length,
        rejected: results.filter((r) => r.status === 'rejected').length,
        persistence_initiated: processedEvents.length,
        results,
      },
    });
  } catch (error: any) {
    console.error('[pbv-full-app/events] Unexpected error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
