import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { recomputeSubmission } from '@/lib/recomputeSubmission';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string; documentId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = await getSessionUser();
    const reviewer = sessionUser?.displayName ?? 'Unknown';
    const { submissionId, documentId } = await params;

    // Packet lock check and Lead check
    const { data: fullApp } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, lead_user_id')
      .eq('form_submission_id', submissionId)
      .single();

    if ((fullApp as any)?.packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked. Reopen the packet before making changes.' },
        { status: 423 }
      );
    }

    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, revision, status, doc_type, label')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const reviewedAt = new Date().toISOString();

    // Check if Application Lead is assigned
    const hasApplicationLead = !!fullApp?.lead_user_id;

    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
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

    if (doc.revision > 0) {
      await supabaseAdmin
        .from('form_submission_document_revisions')
        .update({ status_at_review: null, reviewer, reviewed_at: reviewedAt })
        .eq('document_id', documentId)
        .eq('revision', doc.revision);
    }

    await recomputeSubmission(submissionId);

    if (fullApp) {
      await writePbvApplicationEvent({
        applicationId: fullApp.id,
        eventType: ApplicationEventType.DOCUMENT_WAIVED,
        actorUserId: sessionUser?.userId ?? null,
        actorDisplayName: reviewer,
        documentId,
        payload: { doc_type: doc.doc_type, label: doc.label },
      });
    }

    await logAudit(sessionUser, 'document.waive', 'form_submission_document', documentId, { submissionId }, getClientIp(request));

    return NextResponse.json({ success: true, data: { document_id: documentId, status: 'waived' } });
  } catch (error: any) {
    console.error('Document waive error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
