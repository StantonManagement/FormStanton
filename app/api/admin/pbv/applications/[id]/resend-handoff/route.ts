import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { sendTenantNotification } from '@/lib/notifications/send';
import { buildPreflightDocList } from '@/lib/notifications/buildPreflightDocList';
import { NotificationType } from '@/lib/notifications/types';
import { isHandoffApproved } from '@/lib/pbv/preSendReview';

/**
 * POST /api/admin/pbv/applications/[id]/resend-handoff
 *
 * PRD-85 Phase 3 — operator one-click resend of the intake→signing handoff
 * (`pbv_preflight_checklist`). Calls the same send path as intake completion and
 * the retry sweep, so the resend emits the same notification.sent /
 * notification.failed events and the dashboard indicator clears on success.
 *
 * This is also the manual trigger for the Phase-4 backfill (gated on PRD-86):
 * an operator resends here once an applicant's documents have been regenerated.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;

  try {
    const { data: app, error: fetchErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        'id, head_of_household_name, preferred_language, submission_language, tenant_access_token, intake_status'
      )
      .eq('id', applicationId)
      .maybeSingle();

    if (fetchErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (app.intake_status !== 'complete') {
      return NextResponse.json(
        { success: false, message: 'Intake is not complete — handoff is not due yet.' },
        { status: 409 }
      );
    }

    // PRD-87 gate: a resend only re-sends an ALREADY-approved package. The first
    // release (and any release after regeneration) goes through "Approve & send"
    // in the review UI, which records the approval bound to the current revision.
    if (!(await isHandoffApproved(applicationId))) {
      return NextResponse.json(
        {
          success: false,
          message: 'Document package is not approved at its current revision. Review and Approve & send first.',
        },
        { status: 409 }
      );
    }

    const language = (app.preferred_language ?? app.submission_language ?? 'en') as
      | 'en'
      | 'es'
      | 'pt';
    const docList = await buildPreflightDocList(app.id, language);
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/t/${app.tenant_access_token}`;
    const tenantName = app.head_of_household_name ?? 'there';

    const result = await sendTenantNotification({
      applicationId: app.id,
      notificationType: NotificationType.PBV_PREFLIGHT_CHECKLIST,
      interpolations: {
        tenant_name: tenantName,
        doc_list: docList.docListText,
        magic_link: magicLink,
      },
      triggeredByEventId: `handoff-resend-${app.id}-${new Date().toISOString()}`,
    });

    const reason = 'reason' in result ? result.reason : null;

    await logAudit(
      user,
      'pbv.application.resend_handoff',
      'pbv_full_applications',
      applicationId,
      { status: result.status, reason },
      getClientIp(request)
    );

    const delivered = result.status === 'sent' || result.status === 'email_fallback';
    return NextResponse.json({
      success: delivered,
      sent: delivered,
      status: result.status,
      message: delivered ? 'Handoff re-sent.' : `Handoff not sent: ${reason ?? result.status}`,
    });
  } catch (error: any) {
    console.error('[resend-handoff] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
