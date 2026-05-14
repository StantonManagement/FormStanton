import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// POST /api/admin/submissions/[submissionId]/documents/[documentId]/tier2/confirm
// Application Lead confirms the tier-1 action
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

    // Fetch the document with its application context
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, doc_type, label, owner_review_status, reviewer')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // Check if Application Lead is assigned to this application
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, lead_user_id')
      .eq('form_submission_id', submissionId)
      .single();

    if (!app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    // Only the assigned Lead can confirm
    if (app.lead_user_id !== sessionUser.userId) {
      return NextResponse.json(
        { success: false, message: 'Only the Application Lead can confirm this document' },
        { status: 403 }
      );
    }

    // Update the owner_review_status
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        owner_review_status: 'confirmed',
        owner_reviewed_at: now,
        owner_reviewed_by: sessionUser.userId,
        owner_flag_reason: null, // Clear any previous flag reason
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Write the doc_owner_confirmed event
    await writePbvApplicationEvent({
      applicationId: app.id,
      eventType: ApplicationEventType.DOC_OWNER_CONFIRMED,
      actorUserId: sessionUser.userId,
      actorDisplayName: sessionUser.displayName,
      documentId,
      payload: {
        doc_type: doc.doc_type,
        label: doc.label,
        prior_tier1_actor: doc.reviewer ?? null,
      },
    });

    await logAudit(
      sessionUser,
      'document.owner_confirmed',
      'form_submission_document',
      documentId,
      { doc_type: doc.doc_type },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        owner_review_status: 'confirmed',
        owner_reviewed_at: now,
      },
    });
  } catch (error: any) {
    console.error('[tier2-confirm] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
