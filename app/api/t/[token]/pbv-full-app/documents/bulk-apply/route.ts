/**
 * POST /api/t/[token]/pbv-full-app/documents/bulk-apply
 *
 * Applies an uploaded file to multiple compatible document slots.
 * Creates additional application_documents rows pointing to the same storage_path.
 *
 * Body: { source_doc_id: string, target_doc_ids: string[] }
 *
 * F1 of PRD-41.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'documents-bulk-apply', async (app) => {
    let body: { source_doc_id?: string; target_doc_ids?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      return {
        body: { success: false, message: 'Invalid JSON body' },
        status: 400,
      };
    }

    const { source_doc_id, target_doc_ids } = body;

    if (!source_doc_id || !Array.isArray(target_doc_ids) || target_doc_ids.length === 0) {
      return {
        body: { success: false, message: 'Missing source_doc_id or target_doc_ids' },
        status: 400,
      };
    }

    // Fetch the source document
    const { data: sourceDoc, error: sourceError } = await supabaseAdmin
      .from('application_documents')
      .select('id, anchor_id, storage_path, file_hash, file_name, category, person_slot, status')
      .eq('id', source_doc_id)
      .eq('anchor_type', 'pbv_full_application')
      .single();

    if (sourceError || !sourceDoc) {
      return {
        body: { success: false, message: 'Source document not found' },
        status: 404,
      };
    }

    // Security: Verify source belongs to this application
    if (sourceDoc.anchor_id !== app.id) {
      return {
        body: { success: false, message: 'Source document does not belong to this application' },
        status: 403,
      };
    }

    // Verify source has a file uploaded
    if (!sourceDoc.storage_path || !sourceDoc.file_hash) {
      return {
        body: { success: false, message: 'Source document has no file to apply' },
        status: 400,
      };
    }

    // Fetch target documents
    const { data: targetDocs, error: targetError } = await supabaseAdmin
      .from('application_documents')
      .select('id, anchor_id, status, category, person_slot, revision')
      .in('id', target_doc_ids)
      .eq('anchor_type', 'pbv_full_application');

    if (targetError) {
      console.error('[bulk-apply] Error fetching targets:', targetError);
      return {
        body: { success: false, message: 'Failed to fetch target documents' },
        status: 500,
      };
    }

    // Validate all targets
    const validTargets = [];
    const errors = [];

    for (const target of targetDocs ?? []) {
      // Security: Verify target belongs to this application
      if (target.anchor_id !== app.id) {
        errors.push({ id: target.id, reason: 'Does not belong to this application' });
        continue;
      }

      // Verify target is missing (not already uploaded)
      if (target.status !== 'missing') {
        errors.push({ id: target.id, reason: `Status is ${target.status}, expected missing` });
        continue;
      }

      // Verify category matches source
      if (target.category !== sourceDoc.category) {
        errors.push({ id: target.id, reason: 'Category does not match source' });
        continue;
      }

      // Verify person_slot matches source
      if (target.person_slot !== sourceDoc.person_slot) {
        errors.push({ id: target.id, reason: 'Person slot does not match source' });
        continue;
      }

      validTargets.push(target);
    }

    if (validTargets.length === 0) {
      return {
        body: { success: false, message: 'No valid target documents', errors },
        status: 400,
      };
    }

    // Apply to all valid targets
    const updatedIds: string[] = [];
    const now = new Date().toISOString();

    for (const target of validTargets) {
      const newRevision = target.revision + 1;

      const { error: updateError } = await supabaseAdmin
        .from('application_documents')
        .update({
          storage_path: sourceDoc.storage_path,
          file_hash: sourceDoc.file_hash,
          file_name: sourceDoc.file_name,
          status: 'submitted',
          uploaded_by_role: 'tenant',
          uploaded_by_user_id: null,
          uploaded_by_display_name: 'Tenant',
          upload_source: 'portal',
          revision: newRevision,
          updated_at: now,
        })
        .eq('id', target.id)
        .eq('status', 'missing'); // Race condition protection

      if (updateError) {
        console.error('[bulk-apply] Failed to update target:', target.id, updateError);
        errors.push({ id: target.id, reason: 'Database update failed' });
        continue;
      }

      updatedIds.push(target.id);

      // Emit event for each applied document
      await writePbvApplicationEvent({
        applicationId: app.id,
        eventType: ApplicationEventType.DOCUMENT_UPLOADED_BY_TENANT,
        actorUserId: null,
        actorDisplayName: 'Tenant',
        documentId: target.id,
        payload: {
          doc_type: target.doc_type,
          applied_from_source: source_doc_id,
          file_name: sourceDoc.file_name,
        },
      });
    }

    return {
      body: {
        success: true,
        data: {
          applied_count: updatedIds.length,
          applied_ids: updatedIds,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      status: 200,
    };
  });
}
