import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, requireStantonStaff } from '@/lib/auth';
import { buildStantonFilename, getExtension, extractLastName } from '@/lib/stantonFilename';
import { recomputeSubmission } from '@/lib/recomputeSubmission';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  try {
    const actor = await getSessionUser();
    if (!actor) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId } = await params;

    // Verify the submission exists and is per_document
    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, tenant_name, building_address, unit_number, form_data, review_granularity')
      .eq('id', submissionId)
      .eq('review_granularity', 'per_document')
      .single();

    if (subError || !submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentId = formData.get('document_id') as string | null;
    const staffUploadNote = formData.get('staff_upload_note') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Missing file field' }, { status: 400 });
    }
    if (!documentId) {
      return NextResponse.json({ success: false, message: 'Missing document_id field' }, { status: 400 });
    }

    const ALLOWED_MIME_TYPES = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Accepted: JPEG, PNG, WebP, PDF.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum 20 MB.' },
        { status: 400 }
      );
    }

    // Fetch the document slot — must belong to this submission
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, person_slot, revision, status, form_submission_id')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // Staff may upload to any slot that is not already approved or waived
    if (doc.status === 'approved' || doc.status === 'waived') {
      return NextResponse.json(
        { success: false, message: `Document is ${doc.status} and cannot be replaced.` },
        { status: 409 }
      );
    }

    const newRevision = doc.revision + 1;
    const ext = getExtension(file.name);
    const lastName = extractLastName(submission.tenant_name ?? '');
    const formDataObj = (submission.form_data ?? {}) as Record<string, unknown>;
    const assetId = String(formDataObj.asset_id ?? submission.building_address ?? 'UNK');
    const unit = String(submission.unit_number ?? '0');

    const fileName = buildStantonFilename({
      assetId,
      unit,
      docLabel: doc.label,
      lastName,
      personSlot: doc.person_slot,
      revision: newRevision,
      ext,
    });

    const storagePath = `form-submissions/${submissionId}/${doc.doc_type}/${fileName}`;

    // Upload to storage (never overwrite — upsert: false)
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('form-submissions')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // Insert revision row (append-only)
    const { error: revError } = await supabaseAdmin
      .from('form_submission_document_revisions')
      .insert({
        document_id: documentId,
        revision: newRevision,
        file_name: fileName,
        storage_path: storagePath,
        uploaded_by: `staff:${actor.userId}`,
        created_by: actor.userId,
      });

    if (revError) throw revError;

    // Update document slot with provenance fields
    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        revision: newRevision,
        status: 'submitted',
        file_name: fileName,
        storage_path: storagePath,
        rejection_reason: null,
        reviewed_at: null,
        reviewer: null,
        uploaded_by_role: 'staff',
        uploaded_by_user_id: actor.userId,
        uploaded_by_display_name: actor.displayName,
        staff_upload_note: staffUploadNote?.trim() || null,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Recompute parent submission status
    await recomputeSubmission(submissionId);

    return NextResponse.json(
      { success: true, data: { revision: newRevision, file_name: fileName } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Staff document upload error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
