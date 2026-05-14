import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { getStaleTouched } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/work/stale-touched
 * Returns apps where user was last actor but no movement in 7+ days
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const applications = await getStaleTouched(sessionUser.userId);

    return NextResponse.json({
      success: true,
      data: {
        applications,
        total_count: applications.length,
        threshold_days: 7,
      },
    });
  } catch (error: any) {
    console.error('[me/work/stale-touched] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
