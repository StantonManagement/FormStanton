import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getTier2Backlog } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pbv/rollup/tier2-backlog
 * Returns applications where tier-1 is mostly done but tier-2 is pending
 * Requires: pbv-full-applications:view_team_rollup permission
 */
export async function GET(request: NextRequest) {
  const permissionError = await requirePermission('pbv-full-applications', 'view_team_rollup');
  if (permissionError) return permissionError;

  try {
    const applications = await getTier2Backlog();

    return NextResponse.json({
      success: true,
      data: {
        applications,
        total_count: applications.length,
      },
    });
  } catch (error: any) {
    console.error('[rollup/tier2-backlog] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
