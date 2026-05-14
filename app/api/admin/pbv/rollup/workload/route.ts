import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getWorkloadByReviewer } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pbv/rollup/workload
 * Returns workload rollup per reviewer
 * Requires: pbv-full-applications:view_team_rollup permission
 * Query params:
 *   - range: 'week' | 'month' | 'custom' (default: week)
 *   - from, to: ISO dates for custom range
 */
export async function GET(request: NextRequest) {
  const permissionError = await requirePermission('pbv-full-applications', 'view_team_rollup');
  if (permissionError) return permissionError;

  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') as 'week' | 'month' | 'custom') ?? 'week';
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    const reviewers = await getWorkloadByReviewer(range, from, to);

    return NextResponse.json({
      success: true,
      data: {
        reviewers,
        total_count: reviewers.length,
        range,
        from,
        to,
      },
    });
  } catch (error: any) {
    console.error('[rollup/workload] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
