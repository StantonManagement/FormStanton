import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getAppsWithoutLead } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pbv/rollup/apps-without-lead
 * Returns in-flight applications without an assigned Lead
 * Requires: pbv-full-applications:view_team_rollup permission
 */
export async function GET(request: NextRequest) {
  const permissionError = await requirePermission('pbv-full-applications', 'view_team_rollup');
  if (permissionError) return permissionError;

  try {
    const applications = await getAppsWithoutLead();

    return NextResponse.json({
      success: true,
      data: {
        applications,
        total_count: applications.length,
      },
    });
  } catch (error: any) {
    console.error('[rollup/apps-without-lead] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
