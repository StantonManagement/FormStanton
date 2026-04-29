import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { recordApplicationView } from '@/lib/hach/view-tracking';

/**
 * POST /api/hach/applications/[id]/view
 * Records a reviewer view event for the given application.
 * Called client-side on packet page mount (fire-and-forget).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  await recordApplicationView(id, user.userId, user.displayName);
  return NextResponse.json({ success: true });
}
