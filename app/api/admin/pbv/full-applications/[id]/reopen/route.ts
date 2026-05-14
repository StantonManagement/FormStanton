import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

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

    // Fetch current state — need previous hach_review_status for event payload
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, hach_review_status')
      .eq('id', id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (!(app as any).packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is not currently locked.' },
        { status: 409 }
      );
    }

    const previousHachReviewStatus = (app as any).hach_review_status ?? 'pending_hach';
    const now = new Date().toISOString();

    // Atomically unlock — do NOT reset submitted_to_hach_at, submitted_to_hach_by, hach_packet_revision
    const { error: updateErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        packet_locked: false,
        hach_review_status: null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('packet_locked', true); // guard: only update if currently locked

    if (updateErr) throw updateErr;

    // Write application event
    await writePbvApplicationEvent({
      applicationId: id,
      eventType: ApplicationEventType.HANDOFF_REOPENED,
      actorUserId: sessionUser.userId,
      actorDisplayName: sessionUser.displayName,
      payload: {
        reopen_reason: reason.trim(),
        previous_hach_review_status: previousHachReviewStatus,
      },
    });

    // Post system-authored shared workspace message
    const dateStr = new Date(now).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const systemMessage = `Stanton reopened this packet on ${dateStr}. Reason: ${reason.trim()}`;

    await supabaseAdmin.from('shared_workspace_messages').insert({
      workspace_id: id,
      author_user_id: null,
      author_display_name: 'System',
      author_party_org: 'stanton',
      body: systemMessage,
    });

    await logAudit(
      sessionUser,
      'packet.reopen',
      'pbv_full_application',
      id,
      { reason: reason.trim(), previous_hach_review_status: previousHachReviewStatus },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        packet_locked: false,
        hach_review_status: null,
      },
    });
  } catch (error: any) {
    console.error('[reopen] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
