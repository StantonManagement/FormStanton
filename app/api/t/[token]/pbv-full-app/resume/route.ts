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

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

const RESEND_COOLDOWN_MINUTES = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // L1: route through withTenantContext so resume gets the same centralized
  // rate-limit, packet_locked / submitted_at gates, CSRF (warn) and
  // idempotency as the rest of the tenant API. The 60-minute resend cooldown
  // below is domain-specific and stays inside the handler.
  return withTenantContext(
    request,
    token,
    'resume',
    async (app) => {
      try {
        const phone = app.phone as string | null;
        if (!phone) {
          return {
            body: { success: false, message: 'No phone number on file for this application', code: 'no_phone' },
            status: 422,
          };
        }

        const lastSentRaw = app.resume_token_last_sent_at as string | null;
        if (lastSentRaw) {
          const minutesSince = (Date.now() - new Date(lastSentRaw).getTime()) / (1000 * 60);
          if (minutesSince < RESEND_COOLDOWN_MINUTES) {
            const cooldownRemaining = Math.ceil(RESEND_COOLDOWN_MINUTES - minutesSince);
            return {
              body: {
                success: false,
                message: `Please wait ${cooldownRemaining} more minute(s) before resending.`,
                code: 'rate_limited',
                retry_after_minutes: cooldownRemaining,
              },
              status: 429,
            };
          }
        }

        const now = new Date().toISOString();
        const { error: updateError } = await supabaseAdmin
          .from('pbv_full_applications')
          .update({ resume_token_last_sent_at: now, updated_at: now })
          .eq('id', app.id);
        if (updateError) throw updateError;

        return {
          body: { success: true, data: { resume_token_last_sent_at: now, phone_hint: phone.slice(-4) } },
          status: 200,
        };
      } catch (error: any) {
        console.error('[resume] POST error:', error);
        return {
          body: { success: false, message: 'Internal server error', code: 'server_error' },
          status: 500,
        };
      }
    },
    'id, submitted_at, phone, resume_token_last_sent_at, resume_token_expires_at'
  );
}
