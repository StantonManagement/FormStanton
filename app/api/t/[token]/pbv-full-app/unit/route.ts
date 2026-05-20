/**
 * PATCH /api/t/[token]/pbv-full-app/unit
 *
 * Allows the tenant to correct their unit number before intake submission.
 * Building cannot be changed by the tenant — only unit within the same building.
 * Blocked once submitted_at is set.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'update-unit', async (app) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.unit_number !== 'string' || !body.unit_number.trim()) {
      return { body: { success: false, message: 'unit_number is required' }, status: 400 };
    }

    const unitNumber = body.unit_number.trim();

    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        unit_number: unitNumber,
        updated_at: new Date().toISOString(),
      })
      .eq('id', app.id);

    if (updateError) throw updateError;

    return {
      body: { success: true, data: { unit_number: unitNumber } },
      status: 200,
    };
  }, 'id, submitted_at');
}
