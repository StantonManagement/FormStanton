/**
 * POST /api/webhooks/twilio/inbound
 *
 * Receives inbound SMS from tenants via Twilio.
 * - Validates X-Twilio-Signature
 * - STOP   → sets sms_opted_out_at on all matching applications, emits notification.opted_out
 * - HELP   → sends auto-reply in EN (no state change)
 * - START  → clears sms_opted_out_at, sends confirmation
 * - Other  → logs to tenant_inbound_messages with handled=false
 *
 * Returns TwiML <Response/> (empty) so Twilio does not retry.
 * Auto-replies for STOP/HELP/START are sent via the Twilio API directly here
 * because they are system-level carrier compliance responses, not tenant lifecycle
 * notifications — they bypass opt-out per TCPA carrier rules.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response/>';

export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    const text = await request.text();
    const params: Record<string, string> = {};
    for (const pair of text.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    }

    // Validate Twilio signature
    if (authToken && appUrl) {
      const signature = request.headers.get('x-twilio-signature') ?? '';
      const webhookUrl = `${appUrl}/api/webhooks/twilio/inbound`;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio');
      const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params);
      if (!isValid) {
        console.warn('[twilio-inbound] invalid signature');
        return new NextResponse(EMPTY_TWIML, { status: 403, headers: { 'Content-Type': 'text/xml' } });
      }
    } else {
      console.warn('[twilio-inbound] signature validation skipped — env vars missing');
    }

    const fromPhone = params['From'] ?? '';
    const bodyRaw = params['Body'] ?? '';
    const messageSid = params['MessageSid'] ?? null;
    const keyword = bodyRaw.trim().toUpperCase();

    if (keyword === 'STOP') {
      await handleStop(fromPhone);
    } else if (keyword === 'HELP') {
      await sendAutoReply(fromPhone, 'For help with your Stanton Management application, call (860) 555-0100 or visit stantonmanagement.com. Reply STOP to unsubscribe.');
    } else if (keyword === 'START') {
      await handleStart(fromPhone);
    } else {
      // Always keep the raw audit row.
      await supabaseAdmin.from('tenant_inbound_messages').insert({
        from_phone: fromPhone,
        body: bodyRaw,
        twilio_message_sid: messageSid,
        matched_keyword: null,
        handled: false,
      });

      // Resolve the sender to a PBV application so the reply shows up in the
      // staff<->applicant thread. Unresolvable numbers are left in the audit
      // table only.
      const appId = await resolveApplicationByPhone(fromPhone);
      if (appId) {
        await supabaseAdmin.from('pbv_application_messages').insert({
          full_application_id: appId,
          direction: 'inbound',
          channel: 'sms',
          body: bodyRaw,
          sender_role: 'tenant',
          twilio_message_sid: messageSid,
          delivery_status: 'received',
          created_by: 'tenant',
        });
      }
    }

    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('[twilio-inbound] error:', err);
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } });
  }
}

/**
 * Resolve an inbound sender phone to the most recent PBV application.
 * Phones are stored in varied formats (e.g. "8609954901"); Twilio sends E.164
 * ("+18609954901"). Match on the last 10 digits across a few candidate formats.
 * Returns the most-recently-created matching application id, or null.
 */
async function resolveApplicationByPhone(fromPhone: string): Promise<string | null> {
  const digits = (fromPhone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);

  const candidates = Array.from(
    new Set([
      fromPhone,
      digits,
      last10,
      `+1${last10}`,
      `1${last10}`,
      `+${digits}`,
    ])
  );

  const { data } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, phone, created_at')
    .in('phone', candidates)
    .order('created_at', { ascending: false })
    .limit(1);

  return data && data.length > 0 ? (data[0].id as string) : null;
}

async function handleStop(fromPhone: string): Promise<void> {
  const { data: apps } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id')
    .eq('phone', fromPhone)
    .is('sms_opted_out_at', null);

  if (apps && apps.length > 0) {
    await supabaseAdmin
      .from('pbv_full_applications')
      .update({ sms_opted_out_at: new Date().toISOString() })
      .eq('phone', fromPhone);

    for (const app of apps) {
      try {
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.NOTIFICATION_OPTED_OUT,
          actorUserId: null,
          actorDisplayName: 'system',
          payload: { action: 'opted_out' },
        });
      } catch (err) {
        console.error('[twilio-inbound] failed to emit opted_out event:', err);
      }
    }
  }

  await supabaseAdmin.from('tenant_inbound_messages').insert({
    from_phone: fromPhone,
    body: 'STOP',
    matched_keyword: 'STOP',
    handled: true,
  });

  await sendAutoReply(fromPhone, 'You have been unsubscribed from Stanton Management SMS notifications. Reply START to re-subscribe.');
}

async function handleStart(fromPhone: string): Promise<void> {
  const { data: apps } = await supabaseAdmin
    .from('pbv_full_applications'