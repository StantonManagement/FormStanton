import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { getAppsILead } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/work/apps-i-lead
 * Returns applications where current user is the Application Lead
 * Query params:
 *   - include_finished: 'true' to include approved/denied/withdrawn apps
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
    const includeFinished = searchParams.get('include_finished') === 'true';

    const applications = await getAppsILead(sessionUser.userId, includeFinished);

    return NextResponse.json({
      success: true,
      data: {
        applications,
        total_count: applications.length,
        ready_to_send_count: applications.filter((a) => a.ready_to_send).length,
      },
    });
  } catch (error: any) {
    console.error('[me/work/apps-i-lead] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
