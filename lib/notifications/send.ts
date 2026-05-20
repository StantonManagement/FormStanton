/**
 * send.ts
 *
 * The ONLY file allowed to call twilioClient.messages.create.
 * All SMS sends go through sendTenantNotification.
 * Opt-out gate is non-bypassable.
 * Notification failures never throw — they emit notification.failed and return.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { resolveTenant } from './resolve';
import { renderBody } from './render';
import { NotificationType } from './types';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export type SendResult =
  | { status: 'sent'; notificationId: string; twilioSid: string }
  | { status: 'email_fallback'; notificationId: string; emailSent: boolean; reason: string }
  | { status: 'blocked'; notificationId: string; reason: 'opted_out' | 'missing_phone' | 'invalid_phone' | 'application_not_found' }
  | { status: 'failed'; notificationId: string; reason: string };

export interface SendTenantNotificationParams {
  applicationId: string;
  notificationType: NotificationType;
  interpolations: Record<string, string>;
  triggeredByEventId?: string;
  bulkSendId?: string;
}

export async function sendTenantNotification(
  params: SendTenantNotificationParams
): Promise<SendResult> {
  const { applicationId, notificationType, interpolations, triggeredByEventId, bulkSendId } = params;

  // 1. Resolve phone + language
  const resolved = await resolveTenant(applicationId);

  if (!resolved.ok) {
    const reason = resolved.reason;
    const notificationId = await insertNotificationRow({
      applicationId,
      notificationType,
      language: 'en',
      recipientPhone: '',
      messageBody: '',
      deliveryStatus: 'blocked_missing_data',
      deliveryError: reason,
    });
    return { status: 'blocked', notificationId, reason: reason === 'application_not_found' ? 'application_not_found' : reason === 'missing_phone' ? 'missing_phone' : 'invalid_phone' };
  }

  const { phone, language, optedOut } = resolved.tenant;

  // 2. Opt-out gate — non-bypassable
  if (optedOut) {
    const notificationId = await insertNotificationRow({
      applicationId,
      notificationType,
      language,
      recipientPhone: phone,
      messageBody: '',
      deliveryStatus: 'blocked_missing_data',
      deliveryError: 'opted_out',
    });
    await emitEvent(applicationId, ApplicationEventType.NOTIFICATION_OPTED_OUT, {
      notification_type: notificationType,
      notification_id: notificationId,
      action: 'opted_out',
    });
    return { status: 'blocked', notificationId, reason: 'opted_out' };
  }

  // 3. Fetch active template
  const { data: template, error: tplErr } = await supabaseAdmin
    .from('tenant_notification_templates')
    .select('body')
    .eq('notification_type', notificationType)
    .eq('language', language)
    .eq('active', true)
    .maybeSingle();

  if (tplErr || !template) {
    const notificationId = await insertNotificationRow({
      applicationId,
      notificationType,
      language,
      recipientPhone: phone,
      messageBody: '',
      deliveryStatus: 'failed',
      deliveryError: 'template_missing',
    });
    console.warn(`[notifications/send] template missing for (${notificationType}, ${language})`);
    await emitEvent(applicationId, ApplicationEventType.NOTIFICATION_FAILED, {
      notification_type: notificationType,
      notification_id: notificationId,
      reason: 'template_missing',
      ...(bulkSendId ? { bulk_send_id: bulkSendId } : {}),
    });
    return { status: 'failed', notificationId, reason: 'template_missing' };
  }

  // 4. Render
  const messageBody = renderBody(template.body, interpolations);

  // 5. Insert pending notification row
  const notificationId = await insertNotificationRow({
    applicationId,
    notificationType,
    language,
    recipientPhone: phone,
    messageBody,
    deliveryStatus: 'pending',
    triggeredBy: triggeredByEventId,
  });

  // 6. Send via Twilio
  const fromNumber = process.env.PBV_TWILIO_PHONE_NUMBER;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!fromNumber) {
    await supabaseAdmin
      .from('tenant_notifications')
      .update({ delivery_status: 'failed', delivery_error: 'PBV_TWILIO_PHONE_NUMBER not configured' })
      .eq('id', notificationId);
    await emitEvent(applicationId, ApplicationEventType.NOTIFICATION_FAILED, {
      notification_type: notificationType,
      notification_id: notificationId,
      reason: 'PBV_TWILIO_PHONE_NUMBER not configured',
      ...(bulkSendId ? { bulk_send_id: bulkSendId } : {}),
    });
    return { status: 'failed', notificationId, reason: 'PBV_TWILIO_PHONE_NUMBER not configured' };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const createParams: Record<string, string> = {
      from: fromNumber,
      to: phone,
      body: messageBody,
    };
    if (appUrl) {
      createParams.statusCallback = `${appUrl}/api/webhooks/twilio`;
    }

    const message = await client.messages.create(createParams);

    await supabaseAdmin
      .from('tenant_notifications')
      .update({
        delivery_status: 'queued',
        twilio_message_sid: message.sid,
        sent_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    await emitEvent(applicationId, ApplicationEventType.NOTIFICATION_SENT, {
      notification_type: notificationType,
      notification_id: notificationId,
      twilio_message_sid: message.sid,
      ...(bulkSendId ? { bulk_send_id: bulkSendId } : {}),
    });

    return { status: 'sent', notificationId, twilioSid: message.sid };
  } catch (twilioErr: unknown) {
    const errMsg = twilioErr instanceof Error ? twilioErr.message : String(twilioErr);
    console.warn(`[notifications/send] Twilio failed, attempting email fallback: ${errMsg}`);

    // Try email fallback
    const emailResult = await sendEmailFallback(
      resolved.tenant.email,
      notificationType,
      messageBody,
      language
    );

    if (emailResult.success) {
      await supabaseAdmin
        .from('tenant_notifications')
        .update({
          delivery_status: 'sent_email_fallback',
          delivery_error: `SMS failed: ${errMsg}`,
        })
        .eq('id', notificationId);

      await emitEvent(applicationId, ApplicationEventType.NOTIFICATION_SENT, {
        notification_type: notificationType,
        notification_id: notificationId,
        channel: 'email_fallback',
        sms_error: errMsg,
      });

      return {
        status: 'email_fallback',
        notificationId,
        emailSent: true,
        reason: `SMS failed (${errMsg}), sent via email`,
      };
    }

    // Both SMS and email failed
    await supabaseAdmin
      .from('tenant_notifications')
      .update({
        delivery_status: 'failed',
        delivery_error: `SMS failed: ${errMsg}; Email failed: ${emailResult.error}`,
      })
      .eq('id', notificationId);

    await emitEvent(applicationId, ApplicationEventType.NOTIFICATION_FAILED, {
      notification_type: notificationType,
      notification_id: notificationId,
      reason: `SMS: ${errMsg}; Email: ${emailResult.error}`,
      ...(bulkSendId ? { bulk_send_id: bulkSendId } : {}),
    });

    return {
      status: 'failed',
      notificationId,
      reason: `SMS: ${errMsg}; Email: ${emailResult.error}`,
    };
  }
}

// ── Email Fallback Helper ───────────────────────────────────────────────────────

interface EmailFallbackResult {
  success: boolean;
  error?: string;
}

async function sendEmailFallback(
  email: string | null | undefined,
  notificationType: NotificationType,
  messageBody: string,
  language: string
): Promise<EmailFallbackResult> {
  if (!email) {
    return { success: false, error: 'No email on file' };
  }

  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const subjects: Record<string, string> = {
    en: 'Action Required: Document Update Needed',
    es: 'Accion requerida: Actualizacion de documento necesaria',
    pt: 'Acao necessaria: Atualizacao de documento necessaria',
  };

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d4d0c8;max-width:560px;width:100%;">
        <tr><td style="background:#1a1a2e;padding:24px 32px;">
          <span style="font-family:'Libre Baskerville',Georgia,serif;font-size:18px;color:#ffffff;font-weight:700;">Stanton Management</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 24px;">${messageBody.replace(/\n/g, '<br>')}</p>
          <p style="font-size:11px;color:#999;margin:24px 0 0;line-height:1.5;">This message was sent because we were unable to reach you via SMS. Please update your phone number in the tenant portal if you prefer text notifications.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: 'Stanton Management <noreply@stantonmanagement.com>',
      to: email,
      subject: subjects[language] ?? subjects.en,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Email send failed' };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function insertNotificationRow(fields: {
  applicationId: string;
  notificationType: string;
  language: string;
  recipientPhone: string;
  messageBody: string;
  deliveryStatus: string;
  deliveryError?: string;
  triggeredBy?: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('tenant_notifications')
    .insert({
      application_id: fields.applicationId,
      notification_type: fields.notificationType,
      language: fields.language,
      recipient_phone: fields.recipientPhone,
      message_body: fields.messageBody,
      delivery_status: fields.deliveryStatus,
      delivery_error: fields.deliveryError ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[notifications/send] failed to insert notification row:', error);
    return '';
  }
  return data.id;
}

async function emitEvent(
  applicationId: string,
  eventType: ApplicationEventType,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await writePbvApplicationEvent({
      applicationId,
      eventType,
      actorUserId: null,
      actorDisplayName: 'system',
      payload: payload as never,
    });
  } catch (err) {
    console.error('[notifications/send] failed to emit event:', err);
  }
}
