import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { computeHouseholdIncome } from '@/lib/pbv/income-eligibility';

/**
 * GET /api/pbv/applications/[id]/income-eligibility
 *
 * Computes or re-computes household income eligibility for a PBV application.
 * Accessible to both Stanton staff and HACH reviewers (any authenticated user).
 *
 * Response: EligibilityPayload
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const applicationId = params.id;
    if (!applicationId) {
      return NextResponse.json(
        { success: false, message: 'Application ID required' },
        { status: 400 }
      );
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
