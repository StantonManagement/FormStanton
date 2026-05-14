import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'image/heic',
  'image/heif',
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload
 *
 * Tenant document upload endpoint per PRD-03 Phase 3.
 *
 * Validates:
 *   - Token resolves to valid PBV application
 *   - File presence, MIME type, size (≤25 MB)
 *   - Document row ownership (matches anchor_id)
 *   - Application not locked (packet_locked === false)
 *   - Target document status is 'missing' (for initial upload)
 *
 * Flow:
 *   1. HEIC → JPG conversion via sharp (if applicable)
 *   2. Emit packet_intake_started event
 *   3. Single transaction: update application_documents row
 *   4. Storage upload inside tx try/catch (failure rolls back)
 *   5. Emit packet_intake_committed + document.uploaded_by_tenant events
 *
 * On error outside tx: emit packet_intake_abandoned
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; doc_row_id: string }> }
) {
  const { token, doc_row_id } = await params;
  let applicationId: string | null = null;
  let batchId: string | null = null;

  try {
    // ── Step 1: Resolve token to application ─────────────────────────────────
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, building_address, unit_number, head_of_household_name')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) {
      console.error('[pbv-upload] Error resolving token:', appError);
      return NextResponse.json(
        { success: false, message: 'Failed to resolve token' },
        { status: 500 }
      );
    }

    if (!app) {
      return NextResponse.json(
        { success: false, message: 'Not found' },
        { status: 404 }
      );
    }

    applicationId = app.id;
    batchId = crypto.randomUUID(); // Generate batch ID for packet intake events

    // ── Step 2: Check packet_locked ──────────────────────────────────────────
    if (app.packet_locked) {
      return NextResponse.json(
        {
          success: false,
          message: 'This packet is currently under review. If you have a new document, please contact the Stanton office.',
        },
        { status: 409 }
      );
    }

    // ── Step 3: Fetch and validate document row ────────────────────────────
    const { data: doc, error: docError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, status, revision, person_slot, anchor_id, file_name, storage_path, uploaded_by_display_name, uploaded_by_role, uploaded_by_user_id, upload_source, updated_at, rejection_reason')
      .eq('id', doc_row_id)
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId)
      .single();

    if (docError || !doc) {
      console.error('[pbv-upload] Document not found:', docError);
      return NextResponse.json(
        { success: false, message: 'Document not found' },
        { status: 404 }
      );
    }

    // Phase 4: Allow replace when status is 'submitted' or 'rejected'
    // Block only when status is 'approved' or 'waived'
    const isReplace = doc.status === 'submitted' || doc.status === 'rejected';
    if (doc.status === 'approved' || doc.status === 'waived') {
      return NextResponse.json(
        {
          success: false,
          message: `Document status is ${doc.status} and cannot be replaced.`,
        },
        { status: 409 }
      );
    }

    // ── Step 4: Parse and validate file ────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Missing file field' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum allowed size is 25 MB.' },
        { status: 413 }
      );
    }

    // Check MIME type
    let mimeType = file.type;
    const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif';

    if (!ALLOWED_MIME_TYPES.has(mimeType) && !isHeic) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Accepted: JPEG, PNG, WebP, PDF, HEIC.' },
        { status: 415 }
      );
    }

    // ── Step 5: HEIC → JPG conversion ─────────────────────────────────────
    let fileBuffer: Buffer;
    let finalFileName = file.name;
    let finalMimeType = mimeType;

    if (isHeic) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = await sharp(Buffer.from(arrayBuffer))
          .jpeg({ quality: 90 })
          .toBuffer();
        finalFileName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
        finalMimeType = 'image/jpeg';
      } catch (err) {
        console.error('[pbv-upload] HEIC conversion failed:', err);
        return NextResponse.json(
          { success: false, message: 'Failed to convert HEIC image. Please upload as JPEG instead.' },
          { status: 400 }
        );
      }
    } else {
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    }

    // ── Step 6: Emit packet_intake_started ─────────────────────────────────
    // applicationId is guaranteed non-null here (validated above)
    await writePbvApplicationEvent({
      applicationId: applicationId!,
      eventType: ApplicationEventType.PACKET_INTAKE_STARTED,
      actorUserId: null,
      actorDisplayName: 'Tenant',
      payload: {
        batch_id: batchId,
        source_label: 'tenant_upload',
        file_count: 1,
      },
    });

    // ── Step 7: Single transaction with storage upload ────────────────────
    const newRevision = doc.revision + 1;
    const ext = finalFileName.split('.').pop() ?? 'bin';
    const fileName = `${doc.doc_type}_r${newRevision}.${ext}`;
    const storagePath = `pbv-documents/${applicationId}/${doc_row_id}/${newRevision}.${ext}`;

    // Start transaction (Supabase doesn't support real transactions, but we sequence operations)
    // 1. Update document row
    // For replace: clear rejection_reason if previously rejected
    const updateData = {
      revision: newRevision,
      status: 'submitted' as const,
      file_name: fileName,
      storage_path: storagePath,
      uploaded_by_role: 'tenant' as const,
      uploaded_by_user_id: null, // Anonymous tenant
      uploaded_by_display_name: 'Tenant',
      upload_source: 'tenant_portal' as const,
      updated_at: new Date().toISOString(),
      rejection_reason: isReplace ? null : undefined, // Clear if replace
    };

    // Guard: for new uploads, only update if status is still 'missing'
    // For replace, we accept 'submitted' or 'rejected'
    const query = supabaseAdmin
      .from('application_documents')
      .update(updateData)
      .eq('id', doc_row_id);

    if (!isReplace) {
      query.eq('status', 'missing');
    }

    const { error: updateError } = await query;

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    // 1b. If replace, insert revision row (mirrors PRD-1.5 staff upload pattern)
    if (isReplace) {
      const { error: revError } = await supabaseAdmin
        .from('application_document_revisions')
        .insert({
          application_document_id: doc_row_id,
          revision: doc.revision, // Old revision number (the one being replaced)
          file_name: doc.file_name ?? fileName,
          storage_path: doc.storage_path ?? storagePath,
          uploaded_by: doc.uploaded_by_display_name ?? 'Tenant',
          uploaded_at: doc.updated_at ?? new Date().toISOString(),
          status_at_review: doc.status,
          rejection_reason: doc.rejection_reason,
          reviewer: null,
          reviewed_at: null,
          created_by: 'system', // Migration marker
        });

      // Non-fatal: log but continue
      if (revError) {
        console.error('[pbv-upload] Revision insert error:', revError);
      }
    }

    // 2. Upload to storage (inside the logical transaction)
    try {
      const { error: uploadError } = await supabaseAdmin.storage
        .from('form-submissions')
        .upload(storagePath, fileBuffer, {
          contentType: finalMimeType,
          upsert: false,
        });

      if (uploadError) {
        // Attempt to roll back document update
        await supabaseAdmin
          .from('application_documents')
          .update({
            revision: doc.revision,
            status: isReplace ? (doc.rejection_reason ? 'rejected' : 'submitted') : 'missing',
            file_name: isReplace ? doc.file_name : null,
            storage_path: isReplace ? doc.storage_path : null,
            uploaded_by_role: isReplace ? doc.uploaded_by_role : null,
            uploaded_by_user_id: isReplace ? doc.uploaded_by_user_id : null,
            uploaded_by_display_name: isReplace ? doc.uploaded_by_display_name : null,
            upload_source: isReplace ? doc.upload_source : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', doc_row_id);

        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
    } catch (storageErr: any) {
      // Emit abandoned event and re-throw
      await writePbvApplicationEvent({
        applicationId: applicationId!,
        eventType: ApplicationEventType.PACKET_INTAKE_ABANDONED,
        actorUserId: null,
        actorDisplayName: 'Tenant',
        payload: {
          batch_id: batchId,
          source_label: 'tenant_upload',
          reason: storageErr.message,
        },
      });

      return NextResponse.json(
        { success: false, message: 'Failed to store file. Please try again.' },
        { status: 500 }
      );
    }

    // ── Step 8: Emit success events ─────────────────────────────────────────
    await writePbvApplicationEvent({
      applicationId: applicationId!,
      eventType: ApplicationEventType.PACKET_INTAKE_COMMITTED,
      actorUserId: null,
      actorDisplayName: 'Tenant',
      payload: {
        batch_id: batchId,
        total_pages: 1, // Per-tenant-upload; no page splitting
        template_docs: 1,
        custom_docs: 0,
        discarded_pages: 0,
        source_label: 'tenant_upload',
      },
    });

    await writePbvApplicationEvent({
      applicationId: applicationId!,
      eventType: ApplicationEventType.DOCUMENT_UPLOADED_BY_TENANT,
      actorUserId: null,
      actorDisplayName: 'Tenant',
      documentId: doc_row_id,
      payload: {
        doc_type: doc.doc_type,
        label: doc.label,
        file_name: fileName,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        revision: newRevision,
        file_name: fileName,
        status: 'submitted',
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('[pbv-upload] Unexpected error:', error);

    // Emit abandoned event if we have application context
    if (applicationId && batchId) {
      await writePbvApplicationEvent({
        applicationId: applicationId,
        eventType: ApplicationEventType.PACKET_INTAKE_ABANDONED,
        actorUserId: null,
        actorDisplayName: 'Tenant',
        payload: {
          batch_id: batchId,
          source_label: 'tenant_upload',
          reason: error.message,
        },
      });
    }

    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
