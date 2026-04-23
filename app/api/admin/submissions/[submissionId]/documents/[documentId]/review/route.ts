import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

type ReviewAction = 'approve' | 'reject' | 'waive';

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
    const body = await request.json();
    const { action, rejection_reason, notes } = body as {
      action: ReviewAction;
      rejection_reason?: string;
      notes?: string;
    };

    if (!action || !['approve', 'reject', 'waive'].includes(action)) {
      return NextResponse.json(
        { success: false, message: "action must be 'approve', 'reject', or 'waive'" },
        { status: 400 }
      );
    }

    if (action === 'reject' && !rejection_reason?.trim()) {
      return NextResponse.json(
        { success: false, message: 'rejection_reason is required when action is reject' },
        { status: 400 }
      );
    }

    // Fetch document — verify it belongs to the submission
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, revision, status')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // Verify submission is per_document
    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, review_granularity')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    if (submission.review_granularity !== 'per_document') {
      return NextResponse.json(
        { success: false, message: 'Submission uses atomic review — use the standard PATCH endpoint' },
        { status: 400 }
      );
    }

    const statusMap: Record<ReviewAction, string> = {
      approve: 'approved',
      reject: 'rejected',
      waive: 'waived',
    };
    const newStatus = statusMap[action];
    const reviewedAt = new Date().toISOString();

    // Update the document slot
    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        status: newStatus,
        reviewer,
        reviewed_at: reviewedAt,
        rejection_reason: action === 'reject' ? rejection_reason : null,
        notes: notes ?? null,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Stamp the latest revision with status_at_review (if a revision exists)
    if (doc.revision > 0) {
      await supabaseAdmin
        .from('form_submission_document_revisions')
        .update({
          status_at_review: action === 'waive' ? null : newStatus,
          rejection_reason: action === 'reject' ? rejection_reason : null,
          reviewer,
          reviewed_at: reviewedAt,
        })
        .eq('document_id', documentId)
        .eq('revision', doc.revision);
    }

    // Recompute parent submission status and summary
    await recomputeSubmission(submissionId);

    await logAudit(
      sessionUser,
      `document.${action}`,
      'form_submission_document',
      documentId,
      { submissionId, rejection_reason: action === 'reject' ? rejection_reason : undefined },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: { document_id: documentId, status: newStatus } });
  } catch (error: any) {
    console.error('Document review error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

async function recomputeSubmission(submissionId: string): Promise<void> {
  const { data: docs } = await supabaseAdmin
    .from('form_submission_documents')
    .select('status, required')
    .eq('form_submission_id', submissionId);

  if (!docs) return;

  const summary = { total: docs.length, missing: 0, submitted: 0, approved: 0, rejected: 0, waived: 0 };
  for (const d of docs) {
    summary[d.status as keyof typeof summary] = (summary[d.status as keyof typeof summary] ?? 0) + 1;
  }

  const required = docs.filter(d => d.required);
  let status = 'pending_review';
  if (required.every(d => d.status === 'approved' || d.status === 'waived')) {
    status = 'approved';
  } else if (required.some(d => d.status === 'rejected')) {
    status = 'revision_requested';
  } else if (required.some(d => d.status === 'submitted')) {
    status = 'under_review';
  }

  await supabaseAdmin
    .from('form_submissions')
    .update({ document_review_summary: summary, status })
    .eq('id', submissionId)
    .eq('review_granularity', 'per_document');
}
