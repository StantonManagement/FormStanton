import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

interface ApplicationData {
  id: string;
  packet_locked: boolean;
  stanton_review_status: string;
  hha_application_file: string | null;
  hach_packet_revision: number | null;
}

interface DocumentData {
  required: boolean;
  status: string;
  label: string;
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
    const override_reason: string | null = body.override_reason ?? null;
    const override_failed_checks: string[] | null = body.override_failed_checks ?? null;

    if (override_reason !== null && override_reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'override_reason must not be empty when provided' },
        { status: 400 }
      );
    }

    // Fetch application with row-level lock via .single() — concurrent requests will each
    // read the current state; the UPDATE below is atomic. If already locked, return 409.
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        'id, stanton_review_status, hha_application_file, packet_locked, hach_packet_revision, head_of_household_name, building_address, unit_number'
      )
      .eq('id', id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const typedApp = app as unknown as ApplicationData;

    if (typedApp.packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is already locked and submitted to HACH.' },
        { status: 409 }
      );
    }

    // Re-run pre-flight checks
    const { data: documents } = await supabaseAdmin
      .from('application_documents')
      .select('id, required, status, label')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', id);

    const docs = (documents ?? []) as unknown as DocumentData[];
    const requiredNotCleared = docs.filter(
      (d) => d.required && d.status !== 'approved' && d.status !== 'waived'
    );

    type FailedCheck = { key: string; detail: string };
    const failedChecks: FailedCheck[] = [];

    if (requiredNotCleared.length > 0) {
      failedChecks.push({
        key: 'required_docs_cleared',
        detail: `${requiredNotCleared.length} required document(s) not yet approved or waived.`,
      });
    }
    if (typedApp.stanton_review_status !== 'approved') {
      failedChecks.push({
        key: 'stanton_approved',
        detail: `Stanton review status is "${typedApp.stanton_review_status}", must be "approved".`,
      });
    }
    if (!typedApp.hha_application_file) {
      failedChecks.push({
        key: 'hha_generated',
        detail: 'HHA Application file has not been generated.',
      });
    }

    if (failedChecks.length > 0 && !override_reason) {
      return NextResponse.json(
        {
          success: false,
          message: 'Pre-flight checks failed. Provide override_reason and override_failed_checks to submit anyway.',
          failed_checks: failedChecks,
        },
        { status: 422 }
      );
    }

    const newRevision = (typedApp.hach_packet_revision ?? 0) + 1;
    const now = new Date().toISOString();

    // Atomically lock and stamp the application
    const { error: updateErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        submitted_to_hach_at: now,
        submitted_to_hach_by: sessionUser.userId,
        hach_packet_revision: newRevision,
        packet_locked: true,
        hach_review_status: 'pending_hach',
        updated_at: now,
      })
      .eq('id', id)
      .eq('packet_locked', false); // guard: only update if not already locked

    if (updateErr) throw updateErr;

    // Write application event
    // Note: newRevision > 1 indicates a resend, but we use same event type
    await writePbvApplicationEvent({
      applicationId: id,
      eventType: ApplicationEventType.HANDOFF_SENT,
      actorUserId: sessionUser.userId,
      actorDisplayName: sessionUser.displayName,
      payload: {
        hach_review_status: 'pending_hach',
        hach_packet_revision: newRevision,
        ...(override_reason ? { override_reason, override_failed_checks } : {}),
      },
    });

    // Post system-authored shared workspace message
    const dateStr = new Date(now).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const systemMessage = `Stanton submitted this packet to HACH on ${dateStr}. Revision ${newRevision}.`;

    await supabaseAdmin.from('shared_workspace_messages').insert({
      workspace_id: id,
      author_user_id: null,
      author_display_name: 'System',
      author_party_org: 'stanton',
      body: systemMessage,
    });

    await logAudit(
      sessionUser,
      'packet.send_to_hach',
      'pbv_full_application',
      id,
      { hach_packet_revision: newRevision, override_reason: override_reason ?? undefined },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        hach_packet_revision: newRevision,
        submitted_to_hach_at: now,
        packet_locked: true,
        hach_review_status: 'pending_hach',
      },
    });
  } catch (error: any) {
    console.error('[send-to-hach] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
