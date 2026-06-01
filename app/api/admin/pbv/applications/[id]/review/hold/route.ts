import { NextRequest, NextResponse } from 'next/server';
import { requirePreSendReviewApproval, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { recordReviewDecision } from '@/lib/pbv/preSendReview';

/**
 * POST /api/admin/pbv/applications/[id]/review/hold
 *
 * PRD-87 — "Hold / needs fix". Records a held decision (optional note) and sends
 * nothing. The application stays in review-pending; the note feeds back to a
 * PRD-86 field-map fix.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePreSendReviewApproval();
  if (guard) return guard;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;
  let body: { note?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* note is optional */
  }

  const { data: app, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id')
    .eq('id', applicationId)
    .maybeSingle();
  if (error || !app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }

  const { approval } = await recordReviewDecision({
    applicationId,
    status: 'held',
    approvedBy: user.userId,
    approvedByName: user.displayName ?? user.username ?? 'Unknown',
    note: body.note ?? null,
  });
  if (!approval) {
    return NextResponse.json({ success: false, message: 'Failed to record hold' }, { status: 500 });
  }

  await logAudit(
    user,
    'pbv.application.review_hold',
    'pbv_full_applications',
    applicationId,
    { note: body.note ?? null },
    getClientIp(request)
  );

  return NextResponse.json({ success: true, held: true, message: 'Package held — no handoff sent.' });
}
