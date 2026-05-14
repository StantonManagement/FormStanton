import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildStantonFilename, getExtension, extractLastName } from '@/lib/stantonFilename';
import { recomputeSubmission } from '@/lib/recomputeSubmission';

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
        { success: false, message: `Document is ${doc.status} and cannot be replaced.` },
        { status: 409 }
      );
    }

    // Check packet_locked — tenant-friendly message
    const { data: fullApp } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('packet_locked')
      .eq('form_submission_id', submission.id)
      .single();

    if ((fullApp as any)?.packet_locked) {
      return NextResponse.json(
        {
          success: false,
          message:
            'This packet is currently under HACH review. If you have a new document, please contact the Stanton office.',
        },
        { status: 423 }
      );
    }

    if (doc.status === 'submitted') {
      return NextResponse.json(
        {
          success: false,
          message:
            'This document is awaiting review and cannot be replaced. If there is an error, contact your housing manager.',
        },
        { status: 409 }
      );
    }

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const scanMetadataRaw = formData.get('scan_metadata');

    let scanMetadata: Record<string, unknown> | null = null;
    if (typeof scanMetadataRaw === 'string' && scanMetadataRaw.trim().length > 0) {
      try {
        scanMetadata = JSON.parse(scanMetadataRaw) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ success: false, message: 'Invalid scan_metadata JSON' }, { status: 400 });
      }
    }

    if (!file) {
      return NextResponse.json({ success: false, message: 'Missing file field in form data' }, { status: 400 });
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
        { success: false, message: 'Invalid file type. Accepted formats: JPEG, PNG, WebP, PDF.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File is too large. Maximum allowed size is 20 MB.' },
        { status: 400 }
      );
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
        scan_metadata: scanMetadata,
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

