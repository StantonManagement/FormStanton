import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/admin/submissions/[submissionId]/documents/[documentId]/tier2/flag
// Application Lead flags the tier-1 action for re-review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string; documentId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { submissionId, documentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason }: { reason: string } = body;

    if (!reason || reason.trim().length < 10) {
      return NextResponse.json(
        { success: false, message: 'Flag reason must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Fetch the document with its application context
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, doc_type, label, owner_review_status, reviewer, status')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // Update the owner_review_status and flag reason
    // DO NOT clear the tier-1 assignee per PRD constraint
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        owner_review_status: 'flagged',
        owner_reviewed_at: now,
        owner_reviewed_by: sessionUser.userId,
        owner_flag_reason: reason.trim(),
        status: 'flagged_for_rereview',
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    await logAudit(
      sessionUser,
      'document.owner_flagged',
      'form_submission_document',
      documentId,
      { doc_type: doc.doc_type, reason: reason.trim() },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        owner_review_status: 'flagged',
        owner_reviewed_at: now,
        owner_flag_reason: reason.trim(),
        status: 'flagged_for_rereview',
      },
    });
  } catch (error: any) {
    console.error('[tier2-flag] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
