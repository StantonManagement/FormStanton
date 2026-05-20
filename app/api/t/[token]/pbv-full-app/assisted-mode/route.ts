/**
 * GET /api/t/[token]/pbv-full-app/assisted-mode
 *
 * Returns the active assisted-mode session for this application, if any.
 * The tenant portal calls this on mount to detect whether a staff member
 * has started an assisted session for this application.
 *
 * Reads from the admin iron-session cookie (same cookie jar as admin tabs).
 * This works because the admin opens the tenant portal URL while still
 * logged into their admin session — the session cookie is present in the tab.
 *
 * Returns:
 *   { active: false }  — no assisted session
 *   { active: true, staffDisplayName, staffUserId, startedAt }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    // Resolve token → application id to validate the request is for the right app
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (!app) {
      return NextResponse.json({ active: false });
    }

    // Read admin session cookie
    const session = await getSession();
    const am = session.assistedMode;

    if (!am || am.applicationId !== app.id) {
      return NextResponse.json({ active: false });
    }

    return NextResponse.json({
      active: true,
      staffDisplayName: am.staffDisplayName,
      staffUserId: am.staffUserId,
      startedAt: am.startedAt,
      applicationId: app.id,
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
