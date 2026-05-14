import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getDocAgeDistribution } from '@/lib/work/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pbv/rollup/doc-age
 * Returns document age distribution histogram
 * Requires: pbv-full-applications:view_team_rollup permission
 * Query params:
 *   - uploader_role: 'tenant' | 'staff' | 'hach' (optional filter)
 */
export async function GET(request: NextRequest) {
  const permissionError = await requirePermission('pbv-full-applications', 'view_team_rollup');
  if (permissionError) return permissionError;

  try {
    const { searchParams } = new URL(request.url);
    const uploaderRole = searchParams.get('uploader_role') as 'tenant' | 'staff' | 'hach' | undefined;

    const buckets = await getDocAgeDistribution(uploaderRole);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);

    return NextResponse.json({
      success: true,
      data: {
        buckets,
        total_count: total,
        uploader_role: uploaderRole ?? 'all',
      },
    });
  } catch (error: any) {
    console.error('[rollup/doc-age] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
