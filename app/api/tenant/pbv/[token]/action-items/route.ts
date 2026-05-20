import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tenant/pbv/[token]/action-items
 *
 * DEPRECATED (2026-05-14): This endpoint has been moved to the canonical path.
 * Returns a 301 redirect to the new location.
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  return NextResponse.redirect('/api/t/' + token + '/pbv-full-app/action-items', 301);
}

