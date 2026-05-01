import { supabaseAdmin } from '@/lib/supabase';
import { renderTemplate } from '@/lib/rejection-templates';
import { parsePhoneToE164 } from '@/lib/phoneParser';

export type SendRejectionResult =
  | { status: 'sent'; notificationId: string; twilioSid: string }
  | { status: 'blocked'; notificationId: string; reason: 'missing_phone' | 'missing_language' | 'invalid_phone' }
  | { status: 'failed'; notificationId: string; error: string };

export interface SendRejectionParams {
  documentId: string;
  reasonCode: string;
  customNote?: string;
  reviewerId: string;
}

async function insertNotification(fields: {
  application_id: string;
  document_id: string;
  notification_type: string;
  language: string;
  recipient_phone: string;
  message_body: string;
  template_code?: string;
  delivery_status: string;
  delivery_error?: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('tenant_notifications')
    .insert({
      application_id: fields.application_id,
      document_id: fields.document_id,
      notification_type: fields.notification_type,
      language: fields.language,
      recipient_phone: fields.recipient_phone,
      message_body: fields.message_body,
      template_code: fields.template_code ?? null,
      delivery_status: fields.delivery_status,
      delivery_error: fields.delivery_error ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[notifications] insert failed:', error);
    return null;
  }
  return data.id;
}

export async function sendRejectionNotification(
  params: SendRejectionParams
): Promise<SendRejectionResult> {
  const { documentId, reasonCode, customNote, reviewerId } = params;

  try {
    // 1. Fetch document
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, label, form_submission_id')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      return { status: 'failed', notificationId: '', error: 'Document not found' };
    }

    // 2. Fetch application
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, phone, preferred_language, language_confirmed_at, head_of_household_name')
      .eq('form_submission_id', doc.form_submission_id)
      .single();

    if (appErr || !app) {
      return { status: 'failed', notificationId: '', error: 'Application not found' };
    }

    const applicationId = app.id;
    const lang = (['en', 'es', 'pt'].includes(app.preferred_language ?? '')
      ? app.preferred_language
      : 'en') as 'en' | 'es' | 'pt';

    // 3. Validate phone present
    if (!app.phone) {
      const notificationId = await insertNotification({
        application_id: applicationId,
        document_id: documentId,
        notification_type: 'document_rejected',
        language: lang,
        recipient_phone: '',
        message_body: '',
        template_code: reasonCode,
        delivery_status: 'blocked_missing_data',
        delivery_error: 'No phone number on file',
      }) ?? '';
      return { status: 'blocked', notificationId, reason: 'missing_phone' };
    }

    // 4. Validate language confirmed
    if (!app.preferred_language || !app.language_confirmed_at) {
      const notificationId = await insertNotification({
        application_id: applicationId,
        document_id: documentId,
        notification_type: 'document_rejected',
        language: lang,
        recipient_phone: app.phone,
        message_body: '',
        template_code: reasonCode,
        delivery_status: 'blocked_missing_data',
        delivery_error: 'Language not confirmed by tenant',
      }) ?? '';
      return { status: 'blocked', notificationId, reason: 'missing_language' };
    }

    // 5. Validate E.164 phone
    const e164Phone = parsePhoneToE164(app.phone);
    if (!e164Phone) {
      const notificationId = await insertNotification({
        application_id: applicationId,
        document_id: documentId,
        notification_type: 'document_rejected',
        language: lang,
        recipient_phone: app.phone,
        message_body: '',
        template_code: reasonCode,
        delivery_status: 'blocked_invalid_phone',
        delivery_error: `Phone not parseable to E.164: ${app.phone}`,
      }) ?? '';
      return { status: 'blocked', notificationId, reason: 'invalid_phone' };
    }

    // 6. Render message
    const tenantFirstName = (app.head_of_household_name ?? 'Tenant').split(' ')[0];
    const docShort = (doc.label ?? 'document').split(' ')[0].toLowerCase();
    let messageBody = '';
    try {
      messageBody = await renderTemplate(reasonCode, lang, {
        tenant: tenantFirstName,
        doc: doc.label ?? 'document',
        doc_short: docShort,
        custom: customNote,
      });
    } catch (e: any) {
      return { status: 'failed', notificationId: '', error: `Template render failed: ${e?.message}` };
    }

    // 7. Insert pending notification row
    const notificationId = await insertNotification({
      application_id: applicationId,
      document_id: documentId,
      notification_type: 'document_rejected',
      language: lang,
      recipient_phone: e164Phone,
      message_body: messageBody,
      template_code: reasonCode,
      delivery_status: 'pending',
    });

    if (!notificationId) {
      return { status: 'failed', notificationId: '', error: 'Failed to insert notification row' };
    }

    // 8. Send via Twilio
    const fromNumber = process.env.PBV_TWILIO_PHONE_NUMBER;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!fromNumber) {
      await supabaseAdmin
        .from('tenant_notifications')
        .update({ delivery_status: 'failed', delivery_error: 'PBV_TWILIO_PHONE_NUMBER not configured' })
        .eq('id', notificationId);
      return { status: 'failed', notificationId, error: 'PBV_TWILIO_PHONE_NUMBER not configured' };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio');
      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const createParams: Record<string, string> = {
        from: fromNumber,
        to: e164Phone,
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

      return { status: 'sent', notificationId, twilioSid: message.sid };
    } catch (twilioErr: any) {
      const errMsg = twilioErr?.message ?? String(twilioErr);
      await supabaseAdmin
        .from('tenant_notifications')
        .update({ delivery_status: 'failed', delivery_error: errMsg })
        .eq('id', notificationId);
      return { status: 'failed', notificationId, error: errMsg };
    }
  } catch (outerErr: any) {
    console.error('[notifications] unexpected error:', outerErr);
    return { status: 'failed', notificationId: '', error: outerErr?.message ?? 'Unknown error' };
  }
}
