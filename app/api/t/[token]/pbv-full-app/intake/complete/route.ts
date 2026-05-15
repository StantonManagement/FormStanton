/**
 * POST /api/t/[token]/pbv-full-app/intake/complete
 *
 * Marks intake_status = 'complete' and sets intake_completed_at.
 * Validates that the required sections are present in intake_data.
 * Idempotent: if already complete, returns 200 with existing timestamp.
 *
 * Does NOT trigger form generation — that is a separate explicit call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

const REQUIRED_SECTIONS = ['applicant', 'household'] as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'intake-complete', async (app) => {
    const { data: current, error: readError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('intake_data, intake_status, intake_completed_at')
      .eq('id', app.id)
      .maybeSingle();

    if (readError) throw readError;

    // Idempotent replay
    if (current?.intake_status === 'complete' && current?.intake_completed_at) {
      return {
        body: {
          success: true,
          data: { intake_status: 'complete', intake_completed_at: current.intake_completed_at },
        },
        status: 200,
      };
    }

    // Validate required sections are present
    const intakeData = (current?.intake_data as Record<string, unknown>) ?? {};
    const missingSections = REQUIRED_SECTIONS.filter((s) => !intakeData[s]);

    if (missingSections.length > 0) {
      return {
        body: {
          success: false,
          message: 'Required intake sections are incomplete',
          missing_sections: missingSections,
        },
        status: 422,
      };
    }

    const completedAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        intake_status: 'complete',
        intake_completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('id', app.id);

    if (updateError) throw updateError;

    return {
      body: {
        success: true,
        data: { intake_status: 'complete', intake_completed_at: completedAt },
      },
      status: 200,
    };
  });
}
