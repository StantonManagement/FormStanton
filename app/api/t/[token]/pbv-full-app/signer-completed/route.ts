import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import {
  writePbvApplicationEvent,
  ApplicationEventType,
} from '@/lib/events/application-events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // L1: route through withTenantContext for centralized rate-limit,
  // packet_locked / submitted_at gates, CSRF (warn) and idempotency. The
  // per-signer event de-duplication below is domain-specific and stays.
  // Default select ('id, submitted_at' + packet_locked) is sufficient here.
  return withTenantContext(
    request,
    token,
    'signer-completed',
    async (app) => {
      try {
        const body = await request.json().catch(() => null);
        if (!body?.signer_id || !body?.name || body?.slot == null) {
          return {
            body: { success: false, message: 'signer_id, name, and slot required' },
            status: 400,
          };
        }

        const { signer_id, slot, name } = body as {
          signer_id: string;
          slot: number;
          name: string;
        };

        // Idempotency: only write if no existing event for this signer on this application
        const { data: existing } = await supabaseAdmin
          .from('application_events')
          .select('id')
          .eq('anchor_type', 'pbv_full_application')
          .eq('anchor_id', app.id)
          .eq('event_type', ApplicationEventType.TENANT_SIGNER_COMPLETED)
          .contains('payload', { signer_id })
          .maybeSingle();

        if (existing) {
          return { body: { success: true, data: { already_recorded: true } }, status: 200 };
        }

        const completed_at = new Date().toISOString();

        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.TENANT_SIGNER_COMPLETED,
          actorUserId: null,
          actorDisplayName: name,
          payload: { signer_id, slot, name, completed_at },
        });

        return { body: { success: true, data: { already_recorded: false } }, status: 200 };
      } catch (error: any) {
        console.error('[signer-completed] Unexpected error:', error);
        return {
          body: { success: false, message: 'Internal server error', code: 'server_error' },
          status: 500,
        };
      }
    }
  );
}
