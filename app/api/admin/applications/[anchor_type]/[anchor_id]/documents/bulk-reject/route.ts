/**
 * POST /api/admin/applications/[anchor_type]/[anchor_id]/documents/bulk-reject
 *
 * Bulk reject documents with optional batched notification to tenant.
 * Body: {
 *   rejections: Array<{ document_id: string; reason?: string; reason_key?: string }>;
 *   send_notification?: boolean;
 * }
 *
 * Each rejection must have either reason (free-text) or reason_key (template key).
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { sendTenantNotification } from '@/lib/notifications/send';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id } = await params;
    const body = await request.json().catch(() => null);
    const { rejections, send_notification = false } = body || {};

    if (!Array.isArray(rejections) || rejections.length === 0) {
      return NextResponse.json(
        { success: false, message: 'rejections array is required' },
        { status: 400 }
      );
    }

    // Validate all rejections have required fields
    // Each rejection needs document_id and either reason or reason_key
    for (const rejection of rejections) {
      if (!rejection.document_id) {
        return NextResponse.json(
          { success: false, message: 'Each rejection must have document_id' },
          { status: 400 }
        );
      }
      if (!rejection.reason?.trim() && !rejection.reason_key) {
        return NextResponse.json(
          { success: false, message: 'Each rejection must have either reason or reason_key' },
          { status: 400 }
        );
      }
    }

    // Validate all reason_keys exist in templates table
    const allKeys = rejections
      .map(r => r.reason_key)
      .filter((k): k is string => Boolean(k));

    if (allKeys.length > 0) {
      const { data: validTemplates, error: templateError } = await supabaseAdmin
        .from('pbv_rejection_reason_templates')
        .select('key')
        .in('key', [...new Set(allKeys)]);

      if (templateError) {
        return NextResponse.json(
          { success: false, message: 'Failed to validate rejection keys' },
          { status: 500 }
        );
      }

      const validKeys = new Set(validTemplates?.map(t => t.key) ?? []);
      const invalidKey = allKeys.find(k => !validKeys.has(k));

      if (invalidKey) {
        return NextResponse.json(
          { success: false, message: `Invalid rejection_reason_key: ${invalidKey}` },
          { status: 400 }
        );
      }
    }

    // Get application details
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, tenant_access_token, phone, building_address, unit_number')
      .eq('id', anchor_id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (app.packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked. Reopen the packet before making changes.' },
        { status: 423 }
      );
    }

    const reviewer = sessionUser.displayName;
    const reviewedAt = new Date().toISOString();
    const rejectionResults = [];

    // Process each rejection
    for (const { document_id, reason, reason_key } of rejections) {
      // Build display reason (prefer free-text, fallback to key for notifications)
      const displayReason = reason?.trim() || reason_key || '';

      // Get document details
      const { data: doc, error: docErr } = await supabaseAdmin
        .from('application_documents')
        .select('id, doc_type, label, status, revision')
        .eq('id', document_id)
        .eq('anchor_type', anchor_type)
        .eq('anchor_id', anchor_id)
        .single();

      if (docErr || !doc) {
        rejectionResults.push({ document_id, status: 'not_found', error: 'Document not found' });
        continue;
      }

      // Update document status
      const { error: updateError } = await supabaseAdmin
        .from('application_documents')
        .update({
          status: 'rejected',
          reviewer,
          reviewed_at: reviewedAt,
          rejection_reason: reason?.trim() || null,
          rejection_reason_key: reason_key || null,
        })
        .eq('id', document_id);

      if (updateError) {
        rejectionResults.push({ document_id, status: 'error', error: updateError.message });
        continue;
      }

      // Update revision if exists
      if (doc.revision > 0) {
        await supabaseAdmin
          .from('application_document_revisions')
          .update({
            status_at_review: 'rejected',
            reviewer,
            reviewed_at: reviewedAt,
            rejection_reason: displayReason,
          })
          .eq('application_document_id', document_id)
          .eq('revision', doc.revision);
      }

      // Log event
      await writePbvApplicationEvent({
        applicationId: anchor_id,
        eventType: ApplicationEventType.DOCUMENT_REJECTED,
        actorUserId: sessionUser.userId,
        actorDisplayName: reviewer,
        documentId: document_id,
        payload: {
          doc_type: doc.doc_type,
          label: doc.label,
          rejection_reason: displayReason,
          rejection_reason_key: reason_key,
        },
      });

      rejectionResults.push({
        document_id,
        status: 'rejected',
        label: doc.label,
        reason: displayReason,
      });
    }

    // Send batched notification if requested and there are successful rejections
    let notificationResult = null;
    const successfulRejections = rejectionResults.filter(r => r.status === 'rejected');

    if (send_notification && successfulRejections.length > 0 && app.tenant_access_token) {
      // Construct portal URL with action-items view
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://forms.stantonmgmt.com';
      const portalUrl = `${baseUrl}/pbv-full-app/${app.tenant_access_token}?view=action-items`;

      // Build message body with document list
      const docList = successfulRejections.map(r => `- ${r.label}`).join('\n');
      const count = successfulRejections.length;

      const messageBody =
        count === 1
          ? `Stanton Management: Your document "${successfulRejections[0].label}" needs to be re-uploaded. Reason: ${successfulRejections[0].reason}. Fix it here: ${portalUrl}`
          : `Stanton Management: ${count} documents need to be re-uploaded:\n${docList}\n\nFix them here: ${portalUrl}`;

      notificationResult = await sendTenantNotification({
        applicationId: anchor_id,
        notificationType: 'doc_rejected',
        interpolations: {
          message_body: messageBody,
          portal_url: portalUrl,
          count: count.toString(),
        },
      });

      // Log the request into the staff<->applicant thread so the conversation
      // shows exactly which documents the applicant was asked to redo. Only for
      // PBV applications (the messages table is PBV-scoped).
      if (anchor_type === 'pbv_full_application') {
        try {
          await supabaseAdmin.from('pbv_application_messages').insert({
            full_application_id: anchor_id,
            direction: 'outbound',
            channel: 'sms',
            body: messageBody,
            sender_role: 'system',
            sender_user_id: sessionUser.userId,
            sender_display_name: reviewer,
            related_document_ids: successfulRejections.map(r => r.document_id),
            delivery_status:
              notificationResult.status === 'sent'
                ? 'sent'
                : notificationResult.status === 'email_fallback'
                ? 'email_fallback'
                : `${notificationResult.status}:${(notificationResult as { reason?: string }).reason ?? ''}`,
            twilio_message_sid: notificationResult.status === 'sent' ? notificationResult.twilioSid : null,
            created_by: reviewer,
          });
        } catch (threadErr) {
          console.error('[document bulk-reject] failed to log thread message:', threadErr);
        }
      }

      // Log notification event
      if (notificationResult.status === 'sent') {
        await writePbvApplicationEvent({
          applicationId: anchor_id,
          eventType: ApplicationEventType.NOTIFICATION_SENT,
          actorUserId: sessionUser.userId,
          actorDisplayName: reviewer,
          payload: {
            notification_type: 'doc_rejected',
            notification_id: notificationResult.notificationId,
            twilio_message_sid: notificationResult.twilioSid,
          },
        });
      } else if (notificationResult.status === 'email_fallback' || notificationResult.status === 'failed') {
        await writePbvApplicationEvent({
          applicationId: anchor_id,
          eventType: ApplicationEventType.NOTIFICATION_FAILED,
          actorUserId: sessionUser.userId,
          actorDisplayName: reviewer,
          payload: {
            notification_type: 'doc_rejected',
            notification_id: notificationResult.notificationId,
            reason: notificationResult.reason,
          },
        });
      }
    }

    // Log audit
    await logAudit(
      sessionUser,
      'document.bulk_reject',
      'application_documents',
      anchor_id,
      {
        anchor_type,
        anchor_id,
        rejection_count: successfulRejections.length,
        notification_sent: send_notification,
        notification_result: notificationResult?.status,
      },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        results: rejectionResults,
        notification: notificationResult,
      },
    });

  } catch (error: any) {
    console.error('[document bulk-reject] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
