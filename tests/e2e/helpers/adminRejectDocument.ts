import { supabaseTestClient } from './supabaseTestClient';

export interface RejectDocumentOptions {
  applicationId: string;
  documentId: string;
  rejectionReasonKey?: string;
  rejectionReasonFreeText?: string;
  adminUserId?: string;
  reviewerName?: string;
}

/**
 * Admin helper to reject a document using service-role key.
 * This bypasses the admin auth flow for test efficiency.
 */
export async function adminRejectDocument(
  opts: RejectDocumentOptions
): Promise<void> {
  const reviewer = opts.reviewerName || 'Test Reviewer';
  const reviewedAt = new Date().toISOString();

  // Get document info for event logging
  const { data: doc, error: docErr } = await supabaseTestClient
    .from('application_documents')
    .select('id, doc_type, label, status, revision')
    .eq('id', opts.documentId)
    .single();

  if (docErr || !doc) {
    throw new Error(`Document not found: ${opts.documentId}`);
  }

  // Update document status to rejected
  const { error: updateError } = await supabaseTestClient
    .from('application_documents')
    .update({
      status: 'rejected',
      reviewer,
      reviewed_at: reviewedAt,
      rejection_reason: opts.rejectionReasonFreeText?.trim() || null,
      rejection_reason_key: opts.rejectionReasonKey || null,
    })
    .eq('id', opts.documentId);

  if (updateError) {
    throw new Error(`Failed to reject document: ${updateError.message}`);
  }

  // Update revision if exists
  if (doc.revision > 0) {
    const rejectionReasonDisplay = opts.rejectionReasonFreeText?.trim() || opts.rejectionReasonKey || '';
    await supabaseTestClient
      .from('application_document_revisions')
      .update({
        status_at_review: 'rejected',
        reviewer,
        reviewed_at: reviewedAt,
        rejection_reason: rejectionReasonDisplay,
      })
      .eq('application_document_id', opts.documentId)
      .eq('revision', doc.revision);
  }

  // Write application event
  const { error: eventError } = await supabaseTestClient
    .from('application_events')
    .insert({
      application_id: opts.applicationId,
      event_type: 'document_rejected',
      actor_user_id: opts.adminUserId || 'test-admin-id',
      actor_display_name: reviewer,
      document_id: opts.documentId,
      payload: {
        doc_type: doc.doc_type,
        label: doc.label,
        rejection_reason: opts.rejectionReasonFreeText || opts.rejectionReasonKey || '',
        rejection_reason_key: opts.rejectionReasonKey,
      },
    });

  if (eventError) {
    console.warn('Failed to write rejection event:', eventError.message);
    // Non-fatal - the rejection still happened
  }
}

/**
 * Admin helper to approve a document.
 */
export async function adminApproveDocument(
  opts: {
    applicationId: string;
    documentId: string;
    adminUserId?: string;
    reviewerName?: string;
  }
): Promise<void> {
  const reviewer = opts.reviewerName || 'Test Reviewer';
  const reviewedAt = new Date().toISOString();

  const { data: doc, error: docErr } = await supabaseTestClient
    .from('application_documents')
    .select('id, doc_type, label, revision')
    .eq('id', opts.documentId)
    .single();

  if (docErr || !doc) {
    throw new Error(`Document not found: ${opts.documentId}`);
  }

  // Update document status to approved
  const { error: updateError } = await supabaseTestClient
    .from('application_documents')
    .update({
      status: 'approved',
      reviewer,
      reviewed_at: reviewedAt,
    })
    .eq('id', opts.documentId);

  if (updateError) {
    throw new Error(`Failed to approve document: ${updateError.message}`);
  }

  // Update revision if exists
  if (doc.revision > 0) {
    await supabaseTestClient
      .from('application_document_revisions')
      .update({
        status_at_review: 'approved',
        reviewer,
        reviewed_at: reviewedAt,
      })
      .eq('application_document_id', opts.documentId)
      .eq('revision', doc.revision);
  }

  // Write application event
  const { error: eventError } = await supabaseTestClient
    .from('application_events')
    .insert({
      application_id: opts.applicationId,
      event_type: 'document_approved',
      actor_user_id: opts.adminUserId || 'test-admin-id',
      actor_display_name: reviewer,
      document_id: opts.documentId,
      payload: {
        doc_type: doc.doc_type,
        label: doc.label,
      },
    });

  if (eventError) {
    console.warn('Failed to write approval event:', eventError.message);
  }
}

/**
 * Helper to create a required document for an application.
 */
export async function createRequiredDocument(
  applicationId: string,
  formSubmissionId: string,
  docType: string,
  label: string,
  applicableMembers?: string[]
): Promise<string> {
  const { data: doc, error } = await supabaseTestClient
    .from('application_documents')
    .insert({
      anchor_type: 'pbv_full_application',
      anchor_id: applicationId,
      form_submission_id: formSubmissionId,
      doc_type: docType,
      label,
      status: 'required',
      applicable_members: applicableMembers || [],
    })
    .select('id')
    .single();

  if (error || !doc) {
    throw new Error(`Failed to create document: ${error?.message}`);
  }

  return doc.id;
}
