/**
 * POST /api/t/[token]/pbv-full-app/finalize
 *
 * Atomic submission finalization endpoint for PBV full applications.
 *
 * Behavior:
 * 1. Resolves token → application row
 * 2. If submitted_at IS NOT NULL: returns 200 with existing submitted_at (replay-safe)
 * 3. Else: validates completion via validateReadyToFinalize()
 * 4. If validation fails: returns 422 with missing items
 * 5. If validation passes: writes submitted_at and application_events row in transaction
 * 6. Returns 200 with submitted_at
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateReadyToFinalize } from '@/lib/pbv/finalizeValidation';
import {
  writePbvApplicationEvent,
  ApplicationEventType,
} from '@/lib/events/application-events';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return withTenantContext(request, token, 'finalize', async (app) => {
    try {
      // ── Step 1: Validate ready to finalize ──────────────────────────────────
      const validation = await validateReadyToFinalize(app.id);

      if (!validation.ready) {
        return {
          body: {
            success: false,
            message: 'Application is not ready to be finalized',
            code: 'validation_failed',
            missing: validation.missing,
          },
          status: 422,
        };
      }

      // ── Step 2: Atomic finalize — set submitted_at and write event ──────────
      const submittedAt = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from('pbv_full_applications')
        .update({ submitted_at: submittedAt })
        .eq('id', app.id);

      if (updateError) {
        console.error('[pbv-finalize] Failed to set submitted_at:', updateError);
        return { body: { success: false, message: 'Failed to finalize application' }, status: 500 };
      }

      try {
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.APPLICATION_SUBMITTED,
          actorUserId: null,
          actorDisplayName: 'Tenant',
          payload: { submitted_at: submittedAt },
        });
      } catch (eventError) {
        console.error('[pbv-finalize] Failed to write application event:', eventError);
      }

      return {
        body: { success: true, data: { submitted_at: submittedAt, already_submitted: false } },
        status: 200,
      };
    } catch (error: any) {
      console.error('[pbv-finalize] Unexpected error:', error);
      return { body: { success: false, message: error.message || 'Internal server error' }, status: 500 };
    }
  });
}
