import { supabaseAdmin } from '@/lib/supabase';
import { renderTemplate } from '@/lib/rejection-templates';
import { parsePhoneToE164 } from '@/lib/phoneParser';
import { sendTenantNotification } from '@/lib/notifications/send';

export type SendRejectionResult =
  | { status: 'sent'; notificationId: string; twilioSid: string }
  | { status: 'email_fallback'; notificationId: string; emailSent: boolean; reason: string }
  | { status: 'blocked'; notificationId: string; reason: 'missing_phone' | 'missing_language' | 'invalid_phone' }
  | { status: 'failed'; notificationId: string; error: string };

export interface SendRejectionParams {
  documentId: string;
  reasonCode: string;
  customNote?: string;
  reviewerId: string;
}

export async function sendRejectionNotification(
  params: SendRejectionParams
): Promise<SendRejectionResult> {
  const { documentId, reasonCode, customNote, reviewerId: _reviewerId } = params;

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
      const { data: inserted } = await supabaseAdmin
        .from('tenant_notifications')
        .insert({
          application_id: applicationId,
          document_id: documentId,
          notification_type: 'document_rejected',
          language: lang,
          recipient_phone: '',
          message_body: '',
          template_code: reasonCode,
          delivery_status: 'blocked_missing_data',
          delivery_error: 'No phone number on file',
        })
        .select('id')
        .single();
      return { status: 'blocked', notificationId: inserted?.id ?? '', reason: 'missing_phone' };
    }

    // 4. Validate language confirmed
    if (!app.preferred_language || !app.language_confirmed_at) {
      const { data: inserted } = await supabaseAdmin
        .from('tenant_notifications')
        .insert({
          application_id: applicationId,
          document_id: documentId,
          notification_type: 'document_rejected',
          language: lang,
          recipient_phone: app.phone,
          message_body: '',
          template_code: reasonCode,
          delivery_status: 'blocked_missing_data',
          delivery_error: 'Language not confirmed by tenant',
        })
        .select('id')
        .single();
      return { status: 'blocked', notificationId: inserted?.id ?? '', reason: 'missing_language' };
    }

    // 5. Validate E.164 phone
    const e164Phone = parsePhoneToE164(app.phone);
    if (!e164Phone) {
      const { data: inserted } = await supabaseAdmin
        .from('tenant_notifications')
        .insert({
          application_id: applicationId,
          document_id: documentId,
          notification_type: 'document_rejected',
          language: lang,
          recipient_phone: app.phone,
          message_body: '',
          template_code: reasonCode,
          delivery_status: 'blocked_invalid_phone',
          delivery_error: `Phone not parseable to E.164: ${app.phone}`,
        })
        .select('id')
        .single();
      return { status: 'blocked', notificationId: inserted?.id ?? '', reason: 'invalid_phone' };
    }

    // 6. Render the rejection-specific message body via rejection_reason_templates
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: 'failed', notificationId: '', error: `Template render failed: ${msg}` };
    }

    // 7. Route through the unified send primitive.
    //    Pass message_body as interpolation so the doc_rejected wrapper template
    //    ({message_body} slot) is filled with the already-rendered rejection copy.
    const sendResult = await sendTenantNotification({
      applicationId,
      notificationType: 'doc_rejected',
      interpolations: { message_body: messageBody },
    });

    if (sendResult.status === 'sent') {
      // Update the notification row with the document_id and template_code FKs
      await supabaseAdmin
        .from('tenant_notifications')
        .update({ document_id: documentId, template_code: reasonCode })
        .eq('id', sendResult.notificationId);

      return { status: 'sent', notificationId: sendResult.notificationId, twilioSid: sendResult.twilioSid };
    }

    if (sendResult.status === 'email_fallback') {
      // Update the notification row with the document_id and template_code FKs
      await supabaseAdmin
        .from('tenant_notifications')
        .update({ document_id: documentId, template_code: reasonCode })
        .eq('id', sendResult.notificationId);

      return {
        status: 'email_fallback',
        notificationId: sendResult.notificationId,
        emailSent: sendResult.emailSent,
        reason: sendResult.reason,
      };
    }

    if (sendResult.status === 'blocked') {
      return { status: 'blocked', notificationId: sendResult.notificationId, reason: sendResult.reason as 'missing_phone' | 'missing_language' | 'invalid_phone' };
    }

    return { status: 'failed', notificationId: sendResult.notificationId, error: sendResult.reason };
  } catch (outerErr: unknown) {
    const msg = outerErr instanceof Error ? outerErr.message : String(outerErr);
    console.error('[notifications] unexpected error:', outerErr);
    return { status: 'failed', notificationId: '', error: msg };
  }
}
