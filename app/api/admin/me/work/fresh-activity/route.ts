import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { getFreshActivity } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/work/fresh-activity
 * Returns events from the last 48h on apps where user is involved
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
    const events = await getFreshActivity(sessionUser.userId);

    return NextResponse.json({
      success: true,
      data: {
        events,
        total_count: events.length,
        since: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[me/work/fresh-activity] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
