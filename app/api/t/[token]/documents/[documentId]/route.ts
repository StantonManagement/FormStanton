import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildStantonFilename, getExtension, extractLastName } from '@/lib/stantonFilename';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; documentId: string }> }
) {
  try {
    const { token, documentId } = await params;

    // Resolve token → submission
    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, tenant_name, building_address, unit_number, form_data, review_granularity')
      .eq('tenant_access_token', token)
      .eq('review_granularity', 'per_document')
      .single();

    if (subError || !submission) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    // Fetch the document slot and verify it belongs to this submission
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, required, person_slot, revision, status, form_submission_id')
      .eq('id', documentId)
      .eq('form_submission_id', submission.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    if (doc.status === 'approved' || doc.status === 'waived') {
      return NextResponse.json(
        { success: false, message: `Document is ${doc.status} and cannot be replaced` },
        { status: 409 }
      );
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Missing file field in form data' }, { status: 400 });
    }

    const newRevision = doc.revision + 1;
    const ext = getExtension(file.name);
    const lastName = extractLastName(submission.tenant_name ?? '');

    // Derive asset_id and unit from submission fields
    // form_data may carry asset_id; fall back to building_address slug
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

    const storagePath = `form-submissions/${submission.id}/${doc.doc_type}/${fileName}`;

    // Upload to storage
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
        uploaded_by: 'tenant',
        created_by: 'tenant',
      });

    if (revError) throw revError;

    // Update document slot
    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        revision: newRevision,
        status: 'submitted',
        file_name: fileName,
        storage_path: storagePath,
        rejection_reason: null, // clear previous rejection
        reviewed_at: null,
        reviewer: null,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Recompute parent status and summary
    await recomputeSubmission(submission.id);

    return NextResponse.json({
      success: true,
      data: { revision: newRevision, file_name: fileName },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Tenant document upload error:', error);
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
