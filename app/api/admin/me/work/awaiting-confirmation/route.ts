import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { getAwaitingMyConfirmation } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/work/awaiting-confirmation
 * Returns documents awaiting confirmation for apps where current user is Lead
 * Query params:
 *   - status: 'pending' | 'confirmed' | 'flagged' (defaults to all)
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
    const statusFilter = searchParams.get('status') as 'pending' | 'confirmed' | 'flagged' | undefined;

    const documents = await getAwaitingMyConfirmation(sessionUser.userId, statusFilter);

    return NextResponse.json({
      success: true,
      data: {
        documents,
        total_count: documents.length,
      },
    });
  } catch (error: any) {
    console.error('[me/work/awaiting-confirmation] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
