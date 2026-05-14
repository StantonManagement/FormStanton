import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getRecentOverrides } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pbv/rollup/overrides
 * Returns recent override submissions (last 30 days default)
 * Requires: pbv-full-applications:view_team_rollup permission
 * Query params:
 *   - range_days: number of days to look back (default 30, max 90)
 */
export async function GET(request: NextRequest) {
  const permissionError = await requirePermission('pbv-full-applications', 'view_team_rollup');
  if (permissionError) return permissionError;

  try {
    const { searchParams } = new URL(request.url);
    const rangeDaysParam = searchParams.get('range_days');
    const rangeDays = Math.min(Math.max(parseInt(rangeDaysParam ?? '30', 10) || 30, 1), 90);

    const overrides = await getRecentOverrides(rangeDays);

    return NextResponse.json({
      success: true,
      data: {
        overrides,
        total_count: overrides.length,
        range_days: rangeDays,
      },
    });
  } catch (error: any) {
    console.error('[rollup/overrides] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
