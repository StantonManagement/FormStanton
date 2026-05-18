/**
 * POST /api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer
 *
 * Marks a document as deferred by tenant and schedules first reminder.
 * Called by PRD-42 card stack when tenant taps "I'll get this later".
 * Stub implementation for PRD-43 - PRD-42 will expand this with proper state management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; doc_row_id: string }> }
) {
  const { token, doc_row_id } = await context.params;

  return withTenantContext(request, token, 'document-defer', async (app) => {
    const now = new Date().toISOString();

    try {
      // 1. Verify the document belongs to this application
      const { data: doc, error: docError } = await supabaseAdmin
        .from('application_documents')
        .select('id, doc_type, status')
        .eq('id', doc_row_id)
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
        .single();

      if (docError || !doc) {
        return NextResponse.json(
          { success: false, message: 'Document not found' },
          { status: 404 }
        );
      }

      // 2. Mark document as deferred (stub - PRD-42 will expand this)
      // For now, we'll just log the deferral event
      const { error: updateError } = await supabaseAdmin
        .from('application_documents')
        .update({
          status: 'deferred',
          updated_at: now,
        })
        .eq('id', doc_row_id);

      if (updateError) {
        console.error(`[document-defer] Failed to mark doc ${doc_row_id} as deferred:`, updateError);
        // Don't fail the request - continue with reminder scheduling
      }

      // 3. Schedule first reminder for 3 days from now if not already scheduled sooner
      const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const { data: currentApp, error: fetchError } = await supabaseAdmin
        .from('pbv_full_applications')
        .select('next_reminder_scheduled_at')
        .eq('id', app.id)
        .single();

      if (fetchError) {
        console.error(`[document-defer] Failed to fetch application ${app.id}:`, fetchError);
        return NextResponse.json(
          { success: false, message: 'Failed to fetch application' },
          { status: 500 }
        );
      }

      // Only schedule if no reminder is already scheduled, or if current reminder is later than 3 days
      const shouldSchedule = !currentApp.next_reminder_scheduled_at || 
        new Date(currentApp.next_reminder_scheduled_at) > new Date(threeDaysFromNow);

      if (shouldSchedule) {
        const { error: scheduleError } = await supabaseAdmin
          .from('pbv_full_applications')
          .update({
            next_reminder_scheduled_at: threeDaysFromNow,
            updated_at: now,
          })
          .eq('id', app.id);

        if (scheduleError) {
          console.error(`[document-defer] Failed to schedule reminder for ${app.id}:`, scheduleError);
          return NextResponse.json(
            { success: false, message: 'Failed to schedule reminder' },
            { status: 500 }
          );
        }

        console.log(`[document-defer] Scheduled reminder for application ${app.id} at ${threeDaysFromNow}`);
      }

      // 4. Emit document deferred event
      try {
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.DOCUMENT_DEFERRED,
          actorUserId: null,
          actorDisplayName: 'tenant',
          payload: {
            document_id: doc_row_id,
            doc_type: doc.doc_type,
            scheduled_reminder_at: shouldSchedule ? threeDaysFromNow : currentApp.next_reminder_scheduled_at,
          },
        });
      } catch (eventError) {
        console.error(`[document-defer] Failed to emit event:`, eventError);
        // Don't fail the request
      }

      return NextResponse.json({
        success: true,
        data: {
          document_id: doc_row_id,
          doc_type: doc.doc_type,
          status: 'deferred',
          reminder_scheduled_at: shouldSchedule ? threeDaysFromNow : currentApp.next_reminder_scheduled_at,
        },
      });

    } catch (error) {
      console.error(`[document-defer] Unexpected error for ${app.id}:`, error);
      return NextResponse.json(
        { success: false, message: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
