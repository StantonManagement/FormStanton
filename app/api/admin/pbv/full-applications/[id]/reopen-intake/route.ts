import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { sendTenantNotification } from '@/lib/notifications/send';
import { NotificationType } from '@/lib/notifications/types';

/**
 * POST /api/admin/pbv/full-applications/[id]/reopen-intake
 *
 * Operator one-click "resend to complete missing info". Pulls a COMPLETED
 * intake back into an editable state and notifies the applicant to finish.
 *
 * Unlike `/reopen` (which only unlocks the document packet), this reopens the
 * intake questionnaire itself so the applicant can fill in newly-added fields
 * (income source, addresses, expenses) and provide their full SSN. The applicant
 * then re-completes intake, the forms regenerate with the fresh data, and they
 * sign — all in one continuous session. End state: ready for staff review.
 *
 * The make-or-break step: the tenant bootstrap serves `intake_data` (not
 * `intake_snapshot`) once status is no longer 'complete', so we copy the
 * snapshot back into `intake_data` or the re-walk would render blank.
 */

export const dynamic = 'force-dynamic';

// Tokens never expire structurally (tenantEndpoint does not gate on this), but we
// extend the window so the resent link reads as fresh.
const RESUME_TOKEN_WINDOW_DAYS = 30;

interface ApplicationRow {
  id: string;
  intake_status: string | null;
  submitted_at: string | null;
  intake_snapshot: unknown;
  signing_status: string | null;
  head_of_household_name: string | null;
  preferred_language: string | null;
  submission_language: string | null;
  tenant_access_token: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!userHasPermission(sessionUser, 'pbv-full-applications', 'send_to_hach')) {
    return NextResponse.json(
      { success: false, message: 'Forbidden — send_to_hach permission required' },
      { status: 403 }
    );
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason: string = body.reason ?? '';

    if (!reason.trim()) {
      return NextResponse.json(
        { success: false, message: 'reason is required and must not be empty' },
        { status: 400 }
      );
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        'id, intake_status, submitted_at, intake_snapshot, signing_status, head_of_household_name, preferred_language, submission_language, tenant_access_token'
      )
      .eq('id', id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const typedApp = app as unknown as ApplicationRow;

    // ── Preconditions ──────────────────────────────────────────────────────────
    if (typedApp.intake_status !== 'complete') {
      return NextResponse.json(
        { success: false, message: 'Intake is not complete — there is nothing to reopen.' },
        { status: 409 }
      );
    }
    if (typedApp.submitted_at) {
      return NextResponse.json(
        { success: false, message: 'Application is already finalized/submitted and cannot be reopened here.' },
        { status: 409 }
      );
    }
    const snapshot = typedApp.intake_snapshot;
    const snapshotEmpty =
      snapshot == null ||
      (typeof snapshot === 'object' && Object.keys(snapshot as Record<string, unknown>).length === 0);
    if (snapshotEmpty) {
      return NextResponse.json(
        { success: false, message: 'No intake snapshot on file to pre-fill — cannot reopen safely.' },
        { status: 409 }
      );
    }

    // Refuse if any form has already collected a signer — reopening would orphan
    // signed bytes. (Mia/Santha have 0 signers; this guards the general case.)
    const { data: signedDocs, error: signedErr } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, collected_signer_member_ids')
      .eq('full_application_id', id);
    if (signedErr) throw signedErr;
    const hasCollectedSigners = (signedDocs ?? []).some(
      (d: { collected_signer_member_ids: string[] | null }) =>
        (d.collected_signer_member_ids?.length ?? 0) > 0
    );
    if (hasCollectedSigners) {
      return NextResponse.json(
        {
          success: false,
          message:
            'One or more forms already have a signature. Reopen the packet and void signatures before reopening intake.',
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const resumeTokenExpiresAt = new Date(
      Date.now() + RESUME_TOKEN_WINDOW_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const previousSigningStatus = typedApp.signing_status ?? null;

    // ── Reopen: copy snapshot back into the editable workspace ──────────────────
    // Guard on intake_status='complete' so a double-click is idempotent (the
    // second update matches 0 rows once status has flipped to in_progress).
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        intake_data: snapshot, // ← the critical copy; without it the re-walk is blank
        intake_status: 'in_progress',
        resume_section: 'household',
        intake_completed_at: null,
        signing_status: 'not_started',
        application_review_status: null,
        application_review_status_at: null,
        resume_token_expires_at: resumeTokenExpiresAt,
        packet_locked: false,
        updated_at: now,
      })
      .eq('id', id)
      .eq('intake_status', 'complete')
      .select('id');

    if (updateErr) throw updateErr;
    if (!updated || updated.length === 0) {
      // Lost the race — already reopened by a concurrent request.
      return NextResponse.json(
        { success: false, message: 'Intake was already reopened.' },
        { status: 409 }
      );
    }

    // ── Notify the applicant (non-blocking) ─────────────────────────────────────
    let notificationStatus: string | null = null;
    let notificationReason: string | null = null;
    try {
      const language = (typedApp.preferred_language ?? typedApp.submission_language ?? 'en') as
        | 'en'
        | 'es'
        | 'pt';
      const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/t/${typedApp.tenant_access_token}`;
      const tenantName = typedApp.head_of_household_name ?? 'there';

      const result = await sendTenantNotification({
        applicationId: id,
        notificationType: NotificationType.PBV_COMPLETE_APPLICATION,
        interpolations: {
          tenant_name: tenantName,
          magic_link: magicLink,
        },
        triggeredByEventId: `intake-reopen-${id}-${now}`,
      });
      notificationStatus = result.status;
      notificationReason = 'reason' in result ? (result.reason as string) : null;
    } catch (notifyError: any) {
      console.error('[reopen-intake] notification failed (non-fatal):', notifyError);
      notificationStatus = 'error';
      notificationReason = notifyError?.message ?? 'send failed';
    }

    // ── Audit trail ─────────────────────────────────────────────────────────────
    await writePbvApplicationEvent({
      applicationId: id,
      eventType: ApplicationEventType.INTAKE_REOPENED,
      actorUserId: sessionUser.userId,
      actorDisplayName: sessionUser.displayName,
      payload: {
        reopen_reason: reason.trim(),
        previous_signing_status: previousSigningStatus,
        notification_status: notificationStatus,
      },
    });

    const dateStr = new Date(now).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    await supabaseAdmin.from('shared_workspace_messages').insert({
      workspace_id: id,
      author_user_id: null,
      author_display_name: 'System',
      author_party_org: 'stanton',
      body: `Stanton reopened this application's intake on ${dateStr} so the applicant can complete missing information and sign. Reason: ${reason.trim()}`,
    });

    await logAudit(
      sessionUser,
      'pbv.application.reopen_intake',
      'pbv_full_application',
      id,
      { reason: reason.trim(), previous_signing_status: previousSigningStatus, notification_status: notificationStatus },
      getClientIp(request)
    );

    const delivered = notificationStatus === 'sent' || notificationStatus === 'email_fallback';
    return NextResponse.json({
      success: true,
      data: {
        intake_status: 'in_progress',
        resume_section: 'household',
        notification_status: notificationStatus,
      },
      message: delivered
        ? 'Intake reopened and a completion link was sent to the applicant.'
        : `Intake reopened. Notification not delivered: ${notificationReason ?? notificationStatus ?? 'unknown'}.`,
    });
  } catch (error: any) {
    console.error('[reopen-intake] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
