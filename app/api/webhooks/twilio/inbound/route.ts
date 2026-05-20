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
      await supabaseAdmin.from('tenant_inbound_messages').insert({
        from_phone: fromPhone,
        body: bodyRaw,
        twilio_message_sid: messageSid,
        matched_keyword: null,
        handled: false,
      });
    }

    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('[twilio-inbound] error:', err);
    return new NextResponse(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } });
  }
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
    .from('pbv_full_applications')
    .select('id')
    .eq('phone', fromPhone)
    .not('sms_opted_out_at', 'is', null);

  if (apps && apps.length > 0) {
    await supabaseAdmin
      .from('pbv_full_applications')
      .update({ sms_opted_out_at: null })
      .eq('phone', fromPhone);

    for (const app of apps) {
      try {
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.NOTIFICATION_OPTED_OUT,
          actorUserId: null,
          actorDisplayName: 'system',
          payload: { action: 'rescinded' },
        });
      } catch (err) {
        console.error('[twilio-inbound] failed to emit opted_out rescinded event:', err);
      }
    }
  }

  await supabaseAdmin.from('tenant_inbound_messages').insert({
    from_phone: fromPhone,
    body: 'START',
    matched_keyword: 'START',
    handled: true,
  });

  await sendAutoReply(fromPhone, 'You have been re-subscribed to Stanton Management SMS notifications.');
}

async function sendAutoReply(toPhone: string, message: string): Promise<void> {
  const fromNumber = process.env.PBV_TWILIO_PHONE_NUMBER;
  if (!fromNumber) {
    console.warn('[twilio-inbound] PBV_TWILIO_PHONE_NUMBER not set — cannot send auto-reply');
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({ from: fromNumber, to: toPhone, body: message });
  } catch (err) {
    console.error('[twilio-inbound] auto-reply send failed:', err);
  }
}
