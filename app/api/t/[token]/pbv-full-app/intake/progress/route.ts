/**
 * POST /api/t/[token]/pbv-full-app/intake/progress
 *
 * Advances the intake resume pointer (pbv_full_applications.resume_section)
 * as the applicant moves forward through the wizard.
 *
 * resume_section is a monotonic high-water mark: the furthest section the
 * applicant has legitimately reached. The section page's deep-link guard
 * redirects any request for a section AHEAD of resume_section back to it, so
 * forward navigation (Next) must persist the new furthest section here BEFORE
 * routing to it — otherwise the target lands one section past resume_section
 * and bounces straight back. This endpoint only ever RAISES the pointer; a
 * target at or behind the current furthest section is a no-op, so Back
 * navigation never lowers it.
 *
 * Body: { section: SectionSlug }
 * Blocked once submitted_at / packet_locked (via withTenantContext).
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { SECTION_SLUGS } from '@/lib/pbv/intake-schema';

const ALLOWED_SECTIONS = new Set<string>(SECTION_SLUGS);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(
    request,
    token,
    'intake-progress',
    async (app) => {
      try {
        const body = await request.json().catch(() => null);
        const target = body?.section;

        if (typeof target !== 'string' || !ALLOWED_SECTIONS.has(target)) {
          return { body: { success: false, message: `Unknown section: ${target}` }, status: 400 };
        }

        const currentResume = (app.resume_section as string | null) ?? null;
        const order = SECTION_SLUGS as readonly string[];

        // Monotonic: only raise the pointer. A target at or behind the current
        // furthest section is a no-op (Back navigation must not lower it).
        const shouldAdvance = order.indexOf(target) > order.indexOf(currentResume ?? '');
        const nextResume = shouldAdvance ? target : currentResume ?? target;

        if (shouldAdvance) {
          const { error: updateError } = await supabaseAdmin
            .from('pbv_full_applications')
            .update({ resume_section: nextResume, updated_at: new Date().toISOString() })
            .eq('id', app.id);
          if (updateError) throw updateError;
        }

        return { body: { success: true, data: { resume_section: nextResume } }, status: 200 };
      } catch (error: any) {
        console.error('[intake/progress] POST error:', error);
        return { body: { success: false, message: 'Internal server error', code: 'server_error' }, status: 500 };
      }
    },
    'id, submitted_at, resume_section'
  );
}
