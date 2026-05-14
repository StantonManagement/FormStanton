import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { getMyQueue } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/work/my-queue
 * Returns documents assigned to the current user
 * Query params:
 *   - status: comma-separated list of statuses to filter
 *   - min_age_days: minimum age in days
 *   - flagged_for_rereview: 'true' to only show flagged docs
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
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') ?? undefined;
    const minAgeDays = searchParams.get('min_age_days');
    const flaggedForRereview = searchParams.get('flagged_for_rereview') === 'true';

    const filters = {
      status: statusFilter,
      minAgeDays: minAgeDays ? parseInt(minAgeDays, 10) : undefined,
      flaggedForRereview,
    };

    const documents = await getMyQueue(sessionUser.userId, filters);

    return NextResponse.json({
      success: true,
      data: {
        documents,
        total_count: documents.length,
      },
    });
  } catch (error: any) {
    console.error('[me/work/my-queue] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
