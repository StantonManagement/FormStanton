import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/webhooks/twilio
 *
 * Receives Twilio delivery status callbacks for outbound SMS.
 * - Validates X-Twilio-Signature to reject forged requests (403)
 * - Looks up tenant_notifications by twilio_message_sid
 * - Maps Twilio MessageStatus → delivery_status and updates the row
 *
 * This route is intentionally public — Twilio must reach it without auth.
 * It is NOT in the middleware matcher (/admin/*, /api/admin/*, /hach/*, /api/hach/*)
 * so no middleware bypass is required.
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // 1. Parse form-encoded body (Twilio sends application/x-www-form-urlencoded)
    const text = await request.text();
    const params: Record<string, string> = {};
    for (const pair of text.split('&')) {
      const [k, v] = pair.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    }

    // 2. Verify Twilio signature
    if (authToken && appUrl) {
      const signature = request.headers.get('x-twilio-signature') ?? '';
      const webhookUrl = `${appUrl}/api/webhooks/twilio`;

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio');
      const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params);
      if (!isValid) {
        console.warn('[twilio-webhook] invalid signature');
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      console.warn('[twilio-webhook] TWILIO_AUTH_TOKEN or NEXT_PUBLIC_APP_URL not set — skipping signature verification');
    }

    const messageSid = params['MessageSid'];
    const twilioStatus = params['MessageStatus'];
    const errorCode = params['ErrorCode'] ?? null;
    const errorMessage = params['ErrorMessage'] ?? null;

    if (!messageSid || !twilioStatus) {
      return new NextResponse(null, { status: 200 });
    }

    // 3. Look up notification row
    const { data: notification } = await supabaseAdmin
      .from('tenant_notifications')
      .select('id, delivery_status')
      .eq('twilio_message_sid', messageSid)
      .maybeSingle();

    if (!notification) {
      return new NextResponse(null, { status: 200 });
    }

    // 4. Map Twilio status → internal delivery_status
    // Never downgrade from 'delivered'
    if (notification.delivery_status === 'delivered') {
      return new NextResponse(null, { status: 200 });
    }

    let newStatus: string | null = null;
    const updates: Record<string, string | null> = {};

    switch (twilioStatus) {
      case 'queued':
      case 'sending':
        newStatus = 'queued';
        break;
      case 'sent':
        newStatus = 'sent';
        break;
      case 'delivered':
        newStatus = 'delivered';
        updates.delivered_at = new Date().toISOString();
        break;
      case 'failed':
      case 'undelivered':
        newStatus = 'failed';
        if (errorCode || errorMessage) {
          updates.delivery_error = [errorCode, errorMessage].filter(Boolean).join(': ');
        }
        break;
      default:
        return new NextResponse(null, { status: 200 });
    }

    if (newStatus) {
      await supabaseAdmin
        .from('tenant_notifications')
        .update({ delivery_status: newStatus, ...updates })
        .eq('id', notification.id);
    }

    return new NextResponse(null, { status: 200 });
  } catch (err: any) {
    console.error('[twilio-webhook] error:', err);
    return new NextResponse(null, { status: 200 });
  }
}
