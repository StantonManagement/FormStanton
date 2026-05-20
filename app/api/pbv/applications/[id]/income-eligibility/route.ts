import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { computeHouseholdIncome } from '@/lib/pbv/income-eligibility';

/**
 * GET /api/pbv/applications/[id]/income-eligibility
 *
 * Computes or re-computes household income eligibility for a PBV application.
 * Accessible to Stanton staff unconditionally.
 * HACH users may only access applications that Stanton has submitted to HACH
 * (hach_review_status IS NOT NULL).
 *
 * Response: EligibilityPayload
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json(
        { success: false, message: 'Application ID required' },
        { status: 400 }
      );
    }

    // HACH users may only see applications that Stanton has explicitly submitted to them.
    if (user.user_type === 'hach_admin' || user.user_type === 'hach_reviewer') {
      const { data: app, error: appErr } = await supabaseAdmin
        .from('pbv_full_applications')
        .select('hach_review_status')
        .eq('id', applicationId)
        .single();

      if (appErr || !app) {
        return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
      }

      if (!app.hach_review_status) {
        return NextResponse.json(
          { success: false, message: 'Forbidden — this application has not been submitted to HACH' },
          { status: 403 }
        );
      }
    }

    const payload = await computeHouseholdIncome(applicationId);

    if (payload.error) {
      const isNotFound = payload.error.includes('not found');
      return NextResponse.json(
        { success: false, message: payload.error },
        { status: isNotFound ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error: any) {
    console.error('[income-eligibility] GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
