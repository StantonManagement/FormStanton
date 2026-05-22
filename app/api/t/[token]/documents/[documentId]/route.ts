import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildStantonFilename, getExtension, extractLastName } from '@/lib/stantonFilename';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; documentId: string }> }
) {
  try {
    const { token, documentId } = await params;

    // Resolve token → PBV application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, building_address, unit_number, packet_locked')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    // Fetch the document slot and verify it belongs to this application
    const { data: doc, error: docError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, required, person_slot, revision, status, anchor_id')
      .eq('id', documentId)
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    if (app.packet_locked) {
      return NextResponse.json(
        {
          success: false,
          message:
            'This packet is currently under HACH review. If you have a new document, please contact the Stanton office.',
        },
        { status: 423 }
      );
    }

    if (doc.status === 'approved' || doc.status === 'waived') {
      return NextResponse.json(
        { success: false, message: `Document is ${doc.status} and cannot be replaced.` },
        { status: 409 }
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
    const lastName = extractLastName(app.head_of_household_name ?? '');

    const assetId = String(app.building_address ?? 'UNK');
    const unit = String(app.unit_number ?? '0');

    const fileName = buildStantonFilename({
      assetId,
      unit,
      docLabel: doc.label,
      lastName,
      personSlot: doc.person_slot,
      revision: newRevision,
      ext,
    });

    const storagePath = `pbv-applications/${app.id}/${doc.doc_type}/${fileName}`;

    // Upload to storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('pbv-applications')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    // PRD-81 #A3: race-guard the UPDATE on the (status, revision) we read.
    // Pre-PRD-81 the route uploaded with upsert:false and then ran an
    // unconditional UPDATE — so two concurrent uploads of the same doc both
    // wrote a revision-bumped file, the loser 409'd at storage, but if the
    // winner's UPDATE had not yet run the row could end up out of sync.
    // Now: if 0 rows are affected (another request claimed first), remove
    // the orphan storage object and return 409 so the tenant retries with
    // fresh state instead of seeing a phantom success.
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        revision: newRevision,
        status: 'submitted',
        file_name: fileName,
        storage_path: storagePath,
        rejection_reason: null,
        reviewed_at: null,
        reviewer: null,
        upload_source: 'tenant',
        uploaded_by_role: 'tenant',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .eq('status', doc.status)
      .eq('revision', doc.revision ?? 0)
      .select('id');

    if (updateError) throw updateError;

    if ((updatedRows?.length ?? 0) === 0) {
      // Race lost — another request already advanced this document.
      // Delete the orphan storage object we just uploaded so the bucket
      // stays in sync with the row that actually represents the document.
      const { error: removeError } = await supabaseAdmin.storage
        .from('pbv-applications')
        .remove([storagePath]);
      if (removeError) {
        console.warn(
          JSON.stringify({
            event: 'tenant_document_orphan_remove_failed',
            document_id: documentId,
            storage_path: storagePath,
            error: removeError.message,
          })
        );
      }
      return NextResponse.json(
        {
          success: false,
          message:
            'This document was just uploaded by another request. Refresh to see the latest version.',
          code: 'document_superseded',
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { revision: newRevision, file_name: fileName },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Tenant document upload error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

