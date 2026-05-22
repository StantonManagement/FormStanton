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

  return withTenantContext(request, token, `intake-${section}`, async (app) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== 'object' || body.data === null) {
      return { body: { success: false, message: 'Body must contain a data object' }, status: 400 };
    }

    const sectionData = body.data as Record<string, unknown>;

    // Read current intake_data so we can merge
    const { data: current, error: readError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('intake_data, intake_status, intake_started_at, resume_section')
      .eq('id', app.id)
      .maybeSingle();

    if (readError) throw readError;

    const existingIntakeData = (current?.intake_data as Record<string, unknown>) ?? {};
    const isFirstCall = !current?.intake_started_at;

    const mergedIntakeData = {
      ...existingIntakeData,
      [section]: sectionData,
      _last_saved_at: new Date().toISOString(),
    };

    // resume_section is a monotonic high-water mark: the furthest section the
    // applicant has reached. The section page's deep-link guard redirects any
    // request for a section *ahead* of resume_section back to it, so this
    // autosave must never move the pointer BACKWARD — otherwise editing an
    // earlier section after navigating Back would re-trap the applicant there.
    // Forward advancement is owned by POST .../intake/progress (called on Next);
    // here we only raise the pointer to `section` when `section` is further
    // along the canonical order than the stored value.
    const existingResume = (current?.resume_section as string | null) ?? null;
    const order = SECTION_SLUGS as readonly string[];
    const nextResume =
      order.indexOf(section) > order.indexOf(existingResume ?? '')
        ? section
        : existingResume ?? section;

    const updatePayload: Record<string, unknown> = {
      intake_data: mergedIntakeData,
      intake_status: 'in_progress',
      resume_section: nextResume,
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
  });
}
