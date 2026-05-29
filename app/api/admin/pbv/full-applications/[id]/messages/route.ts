/**
 * GET  /api/admin/pbv/full-applications/[id]/messages
 *   Returns the full staff <-> applicant message thread (oldest first).
 *
 * POST /api/admin/pbv/full-applications/[id]/messages
 *   Sends a free-form SMS to the applicant. Body: { body: string }.
 *   Inserts an outbound pbv_application_messages row, sends via the unified
 *   sendTenantNotification primitive (staff_message passthrough template), then
 *   updates the row with the Twilio sid + delivery status.
 *
 * Auth: admin session (isAuthenticated). All DB access via service-role client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTenantNotification } from '@/lib/notifications/send';
import { NotificationType } from '@/lib/notifications/types';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MESSAGE_SELECT =
  'id, full_application_id, direction, channel, body, sender_role, sender_user_id, sender_display_name, related_document_ids, twilio_message_sid, delivery_status, created_at';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { data: messages, error } = await supabaseAdmin
      .from('pbv_application_messages')
      .select(MESSAGE_SELECT)
      .eq('full_application_id', id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: { messages: messages ?? [] } });
  } catch (error: any) {
    console.error('[admin/messages] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const payload = await request.json().catch(() => null);
    const body: string | undefined = payload?.body;

    if (!body || typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ success: false, message: 'Message body is required' }, { status: 400 });
    }

    const trimmed = body.trim();

    // Verify the application exists and has a phone on file.
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, phone')
      .eq('id', id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }
    if (!app.phone) {
      return NextResponse.json({ success: false, message: 'Application has no phone number on file' }, { status: 400 });
    }

    // Insert the outbound message row first so the thread reflects the attempt
    // even if delivery fails.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('pbv_application_messages')
      .insert({
        full_application_id: id,
        direction: 'outbound',
        channel: 'sms',
        body: trimmed,
        sender_role: 'staff',
        sender_user_id: sessionUser.userId,
        sender_display_name: sessionUser.displayName,
        delivery_status: 'pending',
        created_by: sessionUser.displayName,
      })
      .select(MESSAGE_SELECT)
      .single();

    if (insertErr) throw insertErr;

    // Send via the unified primitive (opt-out gate + template lookup inside).
    const result = await sendTenantNotification({
      applicationId: id,
      notificationType: NotificationType.STAFF_MESSAGE,
      interpolations: { message_body: trimmed },
    });

    const deliveryStatus =
      result.status === 'sent'
        ? 'sent'
        : result.status === 'email_fallback'
        ? 'email_fallback'
        : result.status === 'blocked'
        ? `blocked:${result.reason}`
        : `failed:${result.reason}`;

    const { data: updated } = await supabaseAdmin
      .from('pbv_application_messages')
      .update({
        delivery_status: deliveryStatus,
        twilio_message_sid: result.status === 'sent' ? result.twilioSid : null,
      })
      .eq('id', inserted.id)
      .select(MESSAGE_SELECT)
      .single();

    await logAudit(
      sessionUser,
      'pbv_full_application.message_sent',
      'pbv_application_messages',
      inserted.id,
      { application_id: id, delivery_status: deliveryStatus },
      getClientIp(request)
    );

    const ok = result.status === 'sent' || result.status === 'email_fallback';
    return NextResponse.json(
      {
        success: ok,
        data: { message: updated ?? inserted, send_status: result.status },
        ...(ok ? {} : { message: `Message saved but not delivered: ${deliveryStatus}` }),
      },
      { status: ok ? 200 : 502 }
    );
  } catch (error: any) {
    console.error('[admin/messages] POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
