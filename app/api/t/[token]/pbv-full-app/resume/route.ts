/**
 * POST /api/t/[token]/pbv-full-app/resume
 *
 * Re-sends the SMS magic link to the tenant's phone.
 * Rate-limited: minimum 60 minutes between sends.
 * Updates resume_token_last_sent_at on success.
 *
 * Note: actual SMS sending is delegated to the tenant_notifications pipeline.
 * This endpoint records the re-send event and returns the application state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const RESEND_COOLDOWN_MINUTES = 60;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, phone, submitted_at, resume_token_last_sent_at, resume_token_expires_at')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    if (app.submitted_at) {
      return NextResponse.json(
        { success: false, message: 'Application already submitted', code: 'submitted_locked' },
        { status: 409 }
      );
    }

    if (!app.phone) {
      return NextResponse.json(
        { success: false, message: 'No phone number on file for this application', code: 'no_phone' },
        { status: 422 }
      );
    }

    // Rate-limit check
    if (app.resume_token_last_sent_at) {
      const lastSent = new Date(app.resume_token_last_sent_at);
      const minutesSince = (Date.now() - lastSent.getTime()) / (1000 * 60);
      if (minutesSince < RESEND_COOLDOWN_MINUTES) {
        const cooldownRemaining = Math.ceil(RESEND_COOLDOWN_MINUTES - minutesSince);
        return NextResponse.json(
          {
            success: false,
            message: `Please wait ${cooldownRemaining} more minute(s) before resending.`,
            code: 'rate_limited',
            retry_after_minutes: cooldownRemaining,
          },
          { status: 429 }
        );
      }
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ resume_token_last_sent_at: now, updated_at: now })
      .eq('id', app.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      data: {
        resume_token_last_sent_at: now,
        phone_hint: app.phone.slice(-4),
      },
    });
  } catch (error: any) {
    console.error('[resume] POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
