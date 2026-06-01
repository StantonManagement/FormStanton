import { NextRequest, NextResponse } from 'next/server';
import { requirePreSendReviewApproval, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { sendTenantNotification } from '@/lib/notifications/send';
import { buildPreflightDocList } from '@/lib/notifications/buildPreflightDocList';
import { NotificationType } from '@/lib/notifications/types';
import { getCurrentPackageRevision, recordReviewDecision } from '@/lib/pbv/preSendReview';

/**
 * POST /api/admin/pbv/applications/[id]/review/approve
 *
 * PRD-87 — "Approve & send". Records an approval bound to the CURRENT
 * package_revision, then fires the `pbv_preflight_checklist` handoff in the
 * applicant's language. This is the only path that releases the first send (and
 * any send after a regeneration, which voids the prior approval). A human always
 * approves — there is no auto-approval.
 *
 * Authorized via the single canApprovePreSendReview seam (any Stanton staff today).
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
    .select('id, head_of_household_name, preferred_language, submission_language, tenant_access_token, intake_status')
    .eq('id', applicationId)
    .maybeSingle();

  if (error || !app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }
  if (app.intake_status !== 'complete') {
    return NextResponse.json(
      { success: false, message: 'Intake is not complete — nothing to review yet.' },
      { status: 409 }
    );
  }

  // Refuse to approve an empty package (no generated documents to review).
  const revision = await getCurrentPackageRevision(applicationId);
  if (!revision) {
    return NextResponse.json(
      { success: false, message: 'No generated documents to approve — generate the package first.' },
      { status: 409 }
    );
  }

  // 1. Record the approval bound to the current package revision.
  const { approval } = await recordReviewDecision({
    applicationId,
    status: 'approved',
    approvedBy: user.userId,
    approvedByName: user.displayName ?? user.username ?? 'Unknown',
    note: body.note ?? null,
  });
  if (!approval) {
    return NextResponse.json({ success: false, message: 'Failed to record approval' }, { status: 500 });
  }

  // 2. Release the handoff (the preflight send gate now passes for this revision).
  const language = (app.preferred_language ?? app.submission_language ?? 'en') as 'en' | 'es' | 'pt';
  const docList = await buildPreflightDocList(app.id, language);
  const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/t/${app.tenant_access_token}`;
  const tenantName = app.head_of_household_name ?? 'there';

  const result = await sendTenantNotification({
    applicationId: app.id,
    notificationType: NotificationType.PBV_PREFLIGHT_CHECKLIST,
    interpolations: { tenant_name: tenantName, doc_list: docList.docListText, magic_link: magicLink },
    triggeredByEventId: `handoff-approve-${app.id}-${approval.approved_at}`,
  });

  await logAudit(
    user,
    'pbv.application.review_approve',
    'pbv_full_applications',
    applicationId,
    { package_revision: revision, send_status: result.status },
    getClientIp(request)
  );

  const delivered = result.status === 'sent' || result.status === 'email_fallback';
  const reason = 'reason' in result ? result.reason : null;
  return NextResponse.json({
    success: true,
    approved: true,
    sent: delivered,
    sendStatus: result.status,
    packageRevision: revision,
    message: delivered
      ? 'Package approved and signing handoff sent.'
      : `Package approved; handoff send did not complete (${reason ?? result.status}) — it is eligible for the retry sweep.`,
  });
}
