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
 * 5. If validation passes: calls finalize_pbv_application(...) RPC which sets
 *    submitted_at AND inserts the application.submitted event in a single
 *    transaction. RPC failure -> 500 and the app stays unsubmitted.
 * 6. Returns 200 with submitted_at
 *
 * PRD-64 (audit #10): the pre-PRD-64 code set submitted_at first and wrote
 * the audit event in a swallowing try/catch — an event-insert failure left
 * the app submitted with no submission row in the timeline. The SQL function
 * `finalize_pbv_application` (migration 20260521020000) makes both writes
 * atomic. Note: this bypasses the in-process _notifySubscribers hook for
 * application.submitted; that event has no subscribers today.
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { validateReadyToFinalize } from '@/lib/pbv/finalizeValidation';
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

      // ── Step 2: Atomic finalize — submitted_at + application.submitted event
      // share a transaction inside finalize_pbv_application().
      const submittedAt = new Date().toISOString();

      const { error: rpcError } = await supabaseAdmin.rpc('finalize_pbv_application', {
        p_app_id: app.id,
        p_submitted_at: submittedAt,
        p_actor_display_name: 'Tenant',
      });

      if (rpcError) {
        console.error('[pbv-finalize] finalize_pbv_application RPC failed:', rpcError);
        return {
          body: {
            success: false,
            message: 'Failed to finalize application',
            code: 'finalize_atomic_failed',
          },
          status: 500,
        };
      }

      return {
        body: { success: true, data: { submitted_at: submittedAt, already_submitted: false } },
        status: 200,
      };
    } catch (error: any) {
      console.error('[pbv-finalize] Unexpected error:', error);
      return { body: { success: false, message: 'Internal server error', code: 'server_error' }, status: 500 };
    }
  });
}
