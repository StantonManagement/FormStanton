import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/me/permissions
 * Returns current user's permissions and super-admin status
 */
export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        permissions: sessionUser.permissions,
        isSuperAdmin: sessionUser.isSuperAdmin,
        userId: sessionUser.userId,
        displayName: sessionUser.displayName,
      },
    });
  } catch (error: any) {
    console.error('[me/permissions] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
