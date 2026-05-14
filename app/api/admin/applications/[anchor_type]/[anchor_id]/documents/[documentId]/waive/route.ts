import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string; documentId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id, documentId } = await params;
    const reviewer = sessionUser.displayName;

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, lead_user_id')
      .eq('id', anchor_id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (app.packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked. Reopen the packet before making changes.' },
        { status: 423 }
      );
    }

    const { data: doc, error: docErr } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, status, revision')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const hasApplicationLead = !!app.lead_user_id;
    const reviewedAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        status: 'waived',
        reviewer,
        reviewed_at: reviewedAt,
        rejection_reason: null,
        notes: null,
        owner_review_status: hasApplicationLead ? 'pending' : null,
        owner_reviewed_at: null,
        owner_reviewed_by: null,
        owner_flag_reason: null,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Update revision with review status if a revision exists
    if (doc.revision > 0) {
      await supabaseAdmin
        .from('application_document_revisions')
        .update({
          status_at_review: null,
          reviewer,
          reviewed_at: reviewedAt,
          rejection_reason: null,
        })
        .eq('application_document_id', documentId)
        .eq('revision', doc.revision);
    }

    await writePbvApplicationEvent({
      applicationId: anchor_id,
      eventType: ApplicationEventType.DOCUMENT_WAIVED,
      actorUserId: sessionUser.userId,
      actorDisplayName: reviewer,
      documentId,
      payload: { doc_type: doc.doc_type, label: doc.label },
    });

    await logAudit(
      sessionUser,
      'document.waive',
      'application_document',
      documentId,
      { anchor_type, anchor_id },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: { document_id: documentId, status: 'waived' } });
  } catch (error: any) {
    console.error('[application-doc-waive] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
