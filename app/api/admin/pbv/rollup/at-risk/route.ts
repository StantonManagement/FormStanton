import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getAtRisk } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pbv/rollup/at-risk
 * Returns applications at risk of missing move-in date
 * Requires: pbv-full-applications:view_team_rollup permission
 */
export async function GET(request: NextRequest) {
  const permissionError = await requirePermission('pbv-full-applications', 'view_team_rollup');
  if (permissionError) return permissionError;

  try {
    const applications = await getAtRisk();

    return NextResponse.json({
      success: true,
      data: {
        applications,
        total_count: applications.length,
        at_risk_move_in_days: 14,
      },
    });
  } catch (error: any) {
    console.error('[rollup/at-risk] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
