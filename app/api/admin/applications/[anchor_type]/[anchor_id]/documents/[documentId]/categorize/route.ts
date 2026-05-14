import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, requireStantonStaff } from '@/lib/auth';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string; documentId: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const actor = await getSessionUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id, documentId } = await params;
    const body = await request.json().catch(() => null);

    if (!body?.target_doc_type) {
      return NextResponse.json(
        { success: false, message: 'target_doc_type is required' },
        { status: 400 }
      );
    }

    const { target_doc_type } = body as { target_doc_type: string };

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked')
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

    const { data: doc, error: docError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, storage_path, file_name, original_doc_type')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    if (!doc.storage_path && !doc.file_name) {
      return NextResponse.json(
        { success: false, message: 'Document has no uploaded file — cannot re-categorize an empty slot.' },
        { status: 409 }
      );
    }

    if (doc.doc_type === target_doc_type) {
      return NextResponse.json(
        { success: false, message: 'Target doc_type is the same as current — no move needed.' },
        { status: 409 }
      );
    }

    const { data: targetDoc, error: targetError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, status')
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .eq('doc_type', target_doc_type)
      .single();

    if (targetError || !targetDoc) {
      return NextResponse.json(
        { success: false, message: `Target slot '${target_doc_type}' not found for this application.` },
        { status: 404 }
      );
    }

    if (targetDoc.status === 'approved' || targetDoc.status === 'waived') {
      return NextResponse.json(
        { success: false, message: `Target slot is already ${targetDoc.status} and cannot receive a re-categorized document.` },
        { status: 409 }
      );
    }

    const fromDocType = doc.doc_type;
    const fromLabel = doc.label;

    const { error: targetUpdateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        file_name: doc.file_name,
        storage_path: doc.storage_path,
        status: 'submitted',
        original_doc_type: fromDocType,
        uploaded_by_role: null,
        rejection_reason: null,
        reviewed_at: null,
        reviewer: null,
      })
      .eq('id', targetDoc.id);

    if (targetUpdateError) throw targetUpdateError;

    const { error: sourceUpdateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        file_name: null,
        storage_path: null,
        status: 'missing',
        rejection_reason: null,
        reviewed_at: null,
        reviewer: null,
      })
      .eq('id', documentId);

    if (sourceUpdateError) throw sourceUpdateError;

    await writePbvApplicationEvent({
      applicationId: anchor_id,
      eventType: ApplicationEventType.DOCUMENT_RECATEGORIZED,
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      documentId: targetDoc.id,
      payload: {
        from_doc_type: fromDocType,
        to_doc_type: target_doc_type,
        label: fromLabel,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        moved_to_document_id: targetDoc.id,
        from_doc_type: fromDocType,
        to_doc_type: target_doc_type,
      },
    });
  } catch (error: any) {
    console.error('[application-doc-categorize] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
