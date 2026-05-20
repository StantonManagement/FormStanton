import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { recomputeSubmission } from '@/lib/recomputeSubmission';

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

    const body = await request.json().catch(() => null);
    const rejectionReason = body?.reason_code || body?.rejection_reason || '';
    const notes = body?.internal_notes ?? null;

    if (!rejectionReason?.trim()) {
      return NextResponse.json({ success: false, message: 'rejection_reason is required' }, { status: 400 });
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

    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        status: 'rejected',
        reviewer,
        reviewed_at: reviewedAt,
        rejection_reason: rejectionReason,
        notes,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    if (doc.revision > 0) {
      await supabaseAdmin
        .from('form_submission_document_revisions')
        .update({ status_at_review: 'rejected', rejection_reason: rejectionReason, reviewer, reviewed_at: reviewedAt })
        .eq('document_id', documentId)
        .eq('revision', doc.revision);
    }

    await recomputeSubmission(submissionId);

    await logAudit(sessionUser, 'document.reject', 'form_submission_document', documentId, { submissionId, rejectionReason }, getClientIp(request));

    return NextResponse.json({ success: true, data: { document_id: documentId, status: 'rejected' } });
  } catch (error: any) {
    console.error('Document reject error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
