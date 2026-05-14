import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { getRecentlyCompleted } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/work/recently-completed
 * Returns last N documents the user approved/rejected/waived
 * Query params:
 *   - limit: number of items (default 10, max 50)
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
    const limitParam = searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 50);

    const documents = await getRecentlyCompleted(sessionUser.userId, limit);

    return NextResponse.json({
      success: true,
      data: {
        documents,
        total_count: documents.length,
        limit,
      },
    });
  } catch (error: any) {
    console.error('[me/work/recently-completed] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
