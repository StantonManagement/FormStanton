/**
 * POST /api/t/[token]/pbv-full-app/intake/[section]
 *
 * Saves one section of intake data into intake_data JSONB.
 * Sets intake_status = 'in_progress' on first call, stamps intake_started_at.
 * Idempotent via Idempotency-Key header.
 *
 * Body: { data: Record<string, unknown> }
 * Section key is taken from [section] path param — e.g. 'household', 'income', 'assets'.
 *
 * Blocked once submitted_at is set (application finalized).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { withIdempotency } from '@/lib/idempotency';
import { SECTION_SLUGS, type SectionSlug } from '@/lib/pbv/intake-schema';

const ALLOWED_SECTIONS = new Set<string>(SECTION_SLUGS);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; section: string }> }
) {
  const { token, section } = await context.params;

  if (!ALLOWED_SECTIONS.has(section)) {
    return NextResponse.json(
      { success: false, message: `Unknown section: ${section}` },
      { status: 400 }
    );
  }

  return withIdempotency(request, '', `intake-${section}`, async () => withTenantContext(request, token, `intake-${section}`, async (app) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      return { body: { success: false, message: 'Body must contain a data object' }, status: 400 };
    }

    const sectionData = body.data as Record<string, unknown>;

    // Read current intake_data so we can merge
    const { data: current, error: readError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('intake_data, intake_status, intake_started_at')
      .eq('id', app.id)
      .maybeSingle();

    if (readError) throw readError;

    const existingIntakeData = (current?.intake_data as Record<string, unknown>) ?? {};
    const isFirstCall = !current?.intake_started_at;

    const mergedIntakeData = {
      ...existingIntakeData,
      [section]: sectionData,
      _resume_section: section,
      _last_saved_at: new Date().toISOString(),
    };

    const updatePayload: Record<string, unknown> = {
      intake_data: mergedIntakeData,
      intake_status: 'in_progress',
      updated_at: new Date().toISOString(),
    };

    if (isFirstCall) {
      updatePayload.intake_started_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update(updatePayload)
      .eq('id', app.id);

    if (updateError) throw updateError;

    return {
      body: {
        success: true,
        data: {
          section,
          intake_status: 'in_progress',
        },
      },
      status: 200,
    };
  }));
}
