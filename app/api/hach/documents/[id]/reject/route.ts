import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { sendRejectionNotification } from '@/lib/notifications';
import { safeHachJson } from '@/lib/hach/payload-filter';

/**
 * POST /api/hach/documents/[id]/reject
 *
 * Body: { reason_code: string, reason_text?: string }
 *   reason_text is required when reason_code === 'other'
 *
 * - Auth: requireHachUser() + scope check (document must belong to a HACH-accessible application)
 * - Inserts document_review_actions row (action='rejected')
 * - Updates form_submission_documents.status to 'rejected'
 * - Sends SMS notification via Twilio (lib/notifications.ts)
 * - Returns recomputed packet progress summary (same shape as approve endpoint)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  let body: { reason_code?: string; reason_text?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { reason_code, reason_text } = body;

  if (!reason_code) {
    return NextResponse.json({ success: false, message: 'reason_code is required' }, { status: 400 });
  }

  if (reason_code === 'other' && !reason_text?.trim()) {
    return NextResponse.json(
      { success: false, message: 'reason_text is required when reason_code is "other"' },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch document and scope-check
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, label, status, form_submission_id')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, hach_review_status, form_submission_id, preferred_language, head_of_household_name')
      .eq('form_submission_id', doc.form_submission_id)
      .not('hach_review_status', 'is', null)
      .single();

    if (appErr || !app) {
      return NextResponse.json(
        { success: false, message: 'Application not in HACH review scope' },
        { status: 403 }
      );
    }

    const applicationId = app.id;

    // 2. Validate reason_code exists in the templates table
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('rejection_reason_templates')
      .select('code, label, is_active')
      .eq('code', reason_code)
      .single();

    if (tplErr || !template) {
      return NextResponse.json({ success: false, message: 'Invalid reason_code' }, { status: 400 });
    }
    if (!template.is_active) {
      return NextResponse.json({ success: false, message: 'Rejection reason is inactive' }, { status: 400 });
    }

    // 3. Insert document_review_actions row
    const { error: insertErr } = await supabaseAdmin
      .from('document_review_actions')
      .insert({
        document_id: documentId,
        full_application_id: applicationId,
        reviewer_id: user.userId,
        reviewer_name: user.displayName,
        action: 'rejected',
        reason_code,
        rejection_reason: reason_text ?? template.label,
        notes: reason_text ?? null,
        created_by: user.username,
        source: 'hach',
      });

    if (insertErr) {
      console.error('[hach/reject] insert error:', insertErr);
      return NextResponse.json({ success: false, message: 'Failed to record rejection' }, { status: 500 });
    }

    // 4. Update document status to 'rejected'
    await supabaseAdmin
      .from('form_submission_documents')
      .update({ status: 'rejected' })
      .eq('id', documentId);

    // 5. Update last_activity_at if column exists (non-fatal)
    try {
      await supabaseAdmin
        .from('pbv_full_applications')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', applicationId);
    } catch {
      // Non-fatal — column may not exist yet
    }

    // 6. Send rejection notification via Twilio (non-blocking on failure)
    const notificationResult = await sendRejectionNotification({
      documentId,
      reasonCode: reason_code,
      customNote: reason_text,
      reviewerId: user.userId,
    });

    // Update document_review_actions row with notification_id if available
    if (notificationResult.notificationId) {
      await supabaseAdmin
        .from('document_review_actions')
        .update({ notification_id: notificationResult.notificationId })
        .eq('document_id', documentId)
        .eq('full_application_id', applicationId)
        .eq('action', 'rejected')
        .order('created_at', { ascending: false })
        .limit(1);
    }

    // 7. Recompute packet progress summary
    const { data: allDocs } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, status')
      .eq('form_submission_id', doc.form_submission_id);

    const { data: allActions } = await supabaseAdmin
      .from('document_review_actions')
      .select('document_id, action, created_at')
      .eq('full_application_id', applicationId)
      .order('created_at', { ascending: false });

    const latestByDoc: Record<string, string> = {};
    for (const a of allActions ?? []) {
      if (!latestByDoc[a.document_id]) {
        latestByDoc[a.document_id] = a.action;
      }
    }

    const progress = { approved: 0, pending: 0, rejected: 0, waived: 0, missing: 0, total: 0 };
    for (const d of allDocs ?? []) {
      progress.total++;
      const eff = latestByDoc[d.id];
      if (eff === 'approved') progress.approved++;
      else if (eff === 'rejected') progress.rejected++;
      else if (eff === 'waived') progress.waived++;
      else if (d.status === 'missing') progress.missing++;
      else progress.pending++;
    }

    // 9. Audit log
    await logAudit(
      user,
      'hach.document.reject',
      'form_submission_documents',
      documentId,
      {
        application_id: applicationId,
        document_label: doc.label,
        reason_code,
        reason_text: reason_text ?? null,
        notification_status: notificationResult.status,
        notification_id: notificationResult.notificationId || null,
      },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: safeHachJson({
        document_id: documentId,
        effective_status: 'rejected',
        reviewer_name: user.displayName,
        reviewed_at: new Date().toISOString(),
        reason_code,
        reason_label: template.label,
        reason_text: reason_text ?? null,
        notification: {
          status: notificationResult.status,
          notification_id: notificationResult.notificationId || null,
          twilio_sid: notificationResult.status === 'sent' ? (notificationResult as any).twilioSid : null,
          reason: notificationResult.status === 'blocked' ? (notificationResult as any).reason : null,
          error: notificationResult.status === 'failed' ? (notificationResult as any).error : null,
        },
        progress,
      }),
    });
  } catch (error: any) {
    console.error('[hach/documents/reject] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
