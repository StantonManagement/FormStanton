import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload
 *
 * DEPRECATED (2026-05-14): This endpoint has been moved to the canonical path.
 * Returns a 301 redirect to the new location.
 */
export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ token: string; doc_row_id: string }> }
) {
  const { token, doc_row_id } = await params;
  return NextResponse.redirect('/api/t/' + token + '/pbv-full-app/documents/' + doc_row_id + '/upload', 301);
}

