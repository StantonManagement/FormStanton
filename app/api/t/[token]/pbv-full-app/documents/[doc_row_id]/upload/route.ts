import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import sharp from 'sharp';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { createHash } from 'crypto';

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
 * POST /api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload
 *
 * Tenant document upload endpoint per PRD-03 Phase 3.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; doc_row_id: string }> }
) {
  const { token, doc_row_id } = await params;
  return withTenantContext(
    request,
    token,
    'document-upload',
    async (app) => {
      let batchId: string | null = null;
      try {
        // -- Step 1: Check packet_locked
        if (app.packet_locked) {
          return {
            body: { success: false, message: 'This packet is currently under review. If you have a new document, please contact the Stanton office.' },
            status: 409,
          };
        }

        batchId = crypto.randomUUID();

        // -- Step 2: Fetch and validate document row
        const { data: doc, error: docError } = await supabaseAdmin
          .from('application_documents')
          .select('id, doc_type, label, status, revision, person_slot, anchor_id, file_name, storage_path, file_hash, uploaded_by_display_name, uploaded_by_role, uploaded_by_user_id, upload_source, updated_at, rejection_reason')
          .eq('id', doc_row_id)
          .eq('anchor_type', 'pbv_full_application')
          .eq('anchor_id', app.id)
          .single();

        if (docError || !doc) {
          console.error('[pbv-upload] Document not found:', docError);
          return { body: { success: false, message: 'Document not found' }, status: 404 };
        }

        const isReplace = doc.status === 'submitted' || doc.status === 'rejected';
        if (doc.status === 'approved' || doc.status === 'waived') {
          return {
            body: { success: false, message: `Document status is ${doc.status} and cannot be replaced.` },
            status: 409,
          };
        }

        // -- Step 3: Parse and validate file
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
          return { body: { success: false, message: 'Missing file field' }, status: 400 };
        }

        if (file.size > MAX_FILE_SIZE) {
          return { body: { success: false, message: 'File too large. Maximum allowed size is 25 MB.' }, status: 413 };
        }

        let mimeType = file.type;
        const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif';

        if (!ALLOWED_MIME_TYPES.has(mimeType) && !isHeic) {
          return { body: { success: false, message: 'Invalid file type. Accepted: JPEG, PNG, WebP, PDF, HEIC.' }, status: 415 };
        }

        // -- Step 4: HEIC -> JPG conversion
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
            return { body: { success: false, message: 'Failed to convert HEIC image. Please upload as JPEG instead.' }, status: 400 };
          }
        } else {
          const arrayBuffer = await file.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        }

        // -- Step 5: Emit packet_intake_started
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.PACKET_INTAKE_STARTED,
          actorUserId: null,
          actorDisplayName: 'Tenant',
          payload: { batch_id: batchId, source_label: 'tenant_upload', file_count: 1 },
        });

        // -- Step 6: Compute file hash + Update document row + storage upload
        const newRevision = doc.revision + 1;
        const ext = finalFileName.split('.').pop() ?? 'bin';
        const fileName = `${doc.doc_type}_r${newRevision}.${ext}`;
        const storagePath = `pbv-documents/${app.id}/${doc_row_id}/${newRevision}.${ext}`;

        // Compute SHA-256 hash of file content for dedup detection (PRD-41 F1)
        const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

        const updateData = {
          revision: newRevision,
          status: 'submitted' as const,
          file_name: fileName,
          storage_path: storagePath,
          file_hash: fileHash,
          uploaded_by_role: 'tenant' as const,
          uploaded_by_user_id: null,
          uploaded_by_display_name: 'Tenant',
          upload_source: 'portal' as const,
          updated_at: new Date().toISOString(),
          rejection_reason: isReplace ? null : undefined,
        };

        const baseQuery = supabaseAdmin
          .from('application_documents')
          .update(updateData)
          .eq('id', doc_row_id);

        const { error: updateError } = isReplace
          ? await baseQuery
          : await baseQuery.eq('status', 'missing');
        if (updateError) {
          throw new Error(`Failed to update document: ${updateError.message}`);
        }

        if (isReplace) {
          const { error: revError } = await supabaseAdmin
            .from('application_document_revisions')
            .insert({
              application_document_id: doc_row_id,
              revision: doc.revision,
              file_name: doc.file_name ?? fileName,
              storage_path: doc.storage_path ?? storagePath,
              uploaded_by: doc.uploaded_by_display_name ?? 'Tenant',
              uploaded_at: doc.updated_at ?? new Date().toISOString(),
              status_at_review: doc.status,
              rejection_reason: doc.rejection_reason,
              reviewer: null,
              reviewed_at: null,
              created_by: 'system',
            });
          if (revError) {
            console.error('[pbv-upload] Revision insert error:', revError);
          }
        }

        try {
          const { error: uploadError } = await supabaseAdmin.storage
            .from('form-submissions')
            .upload(storagePath, fileBuffer, { contentType: finalMimeType, upsert: false });

          if (uploadError) {
            await supabaseAdmin
              .from('application_documents')
              .update({
                revision: doc.revision,
                status: isReplace ? (doc.rejection_reason ? 'rejected' : 'submitted') : 'missing',
                file_name: isReplace ? doc.file_name : null,
                storage_path: isReplace ? doc.storage_path : null,
                file_hash: isReplace ? doc.file_hash : null,
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
          await writePbvApplicationEvent({
            applicationId: app.id,
            eventType: ApplicationEventType.PACKET_INTAKE_ABANDONED,
            actorUserId: null,
            actorDisplayName: 'Tenant',
            payload: { batch_id: batchId, source_label: 'tenant_upload', reason: storageErr.message },
          });
          return { body: { success: false, message: 'Failed to store file. Please try again.' }, status: 500 };
        }

        // -- Step 7: Emit success events
        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.PACKET_INTAKE_COMMITTED,
          actorUserId: null,
          actorDisplayName: 'Tenant',
          payload: { batch_id: batchId, total_pages: 1, template_docs: 1, custom_docs: 0, discarded_pages: 0, source_label: 'tenant_upload' },
        });

        await writePbvApplicationEvent({
          applicationId: app.id,
          eventType: ApplicationEventType.DOCUMENT_UPLOADED_BY_TENANT,
          actorUserId: null,
          actorDisplayName: 'Tenant',
          documentId: doc_row_id,
          payload: { doc_type: doc.doc_type, label: doc.label, file_name: fileName },
        });

        return {
          body: { success: true, data: { revision: newRevision, file_name: fileName, status: 'submitted' } },
          status: 201,
        };

      } catch (error: any) {
        console.error('[pbv-upload] Unexpected error:', error);
        if (batchId) {
          await writePbvApplicationEvent({
            applicationId: app.id,
            eventType: ApplicationEventType.PACKET_INTAKE_ABANDONED,
            actorUserId: null,
            actorDisplayName: 'Tenant',
            payload: { batch_id: batchId, source_label: 'tenant_upload', reason: 'Upload failed' },
          });
        }
        return { body: { success: false, message: 'Upload failed. Please try again.', code: 'upload_failed' }, status: 500 };
      }
    },
    'id, packet_locked, submitted_at'
  );
}