import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, requireStantonStaff } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string; documentId: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId, documentId } = await params;
    const body = await request.json().catch(() => null);

    if (!body?.target_doc_type) {
      return NextResponse.json(
        { success: false, message: 'target_doc_type is required' },
        { status: 400 }
      );
    }

    const { target_doc_type } = body as { target_doc_type: string };

    // Fetch the source document — must belong to this submission and have a file
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, form_submission_id, storage_path, file_name, original_doc_type')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
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

    // Fetch the target document slot — must exist in this submission
    const { data: targetDoc, error: targetError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, status')
      .eq('form_submission_id', submissionId)
      .eq('doc_type', target_doc_type)
      .single();

    if (targetError || !targetDoc) {
      return NextResponse.json(
        { success: false, message: `Target slot '${target_doc_type}' not found in this submission.` },
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

    // Move: copy file fields from source → target, clear source slot
    // PRD: do NOT auto-supersede — both slots remain visible
    const { error: targetUpdateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        file_name: doc.file_name,
        storage_path: doc.storage_path,
        status: 'submitted',
        original_doc_type: fromDocType,
        uploaded_by_role: null, // will be re-stamped on next upload if needed
        rejection_reason: null,
        reviewed_at: null,
        reviewer: null,
      })
      .eq('id', targetDoc.id);

    if (targetUpdateError) throw targetUpdateError;

    // Clear the source slot (file is now tracked at target)
    const { error: sourceUpdateError } = await supabaseAdmin
      .from('form_submission_documents')
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

    return NextResponse.json({
      success: true,
      data: {
        moved_to_document_id: targetDoc.id,
        from_doc_type: fromDocType,
        to_doc_type: target_doc_type,
      },
    });
  } catch (error: any) {
    console.error('Document re-categorize error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
