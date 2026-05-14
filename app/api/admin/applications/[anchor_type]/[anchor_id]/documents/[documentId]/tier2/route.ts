import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { logAudit, getClientIp } from '@/lib/audit';

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

    const { data: doc, error: docErr } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, owner_review_status, reviewer')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, lead_user_id')
      .eq('id', anchor_id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (app.lead_user_id !== sessionUser.userId) {
      return NextResponse.json(
        { success: false, message: 'Only the Application Lead can confirm this document' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        owner_review_status: 'confirmed',
        owner_reviewed_at: now,
        owner_reviewed_by: sessionUser.userId,
        owner_flag_reason: null,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    await writePbvApplicationEvent({
      applicationId: anchor_id,
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
      'application_document',
      documentId,
      { doc_type: doc.doc_type, anchor_type, anchor_id },
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
    console.error('[application-doc-tier2] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
