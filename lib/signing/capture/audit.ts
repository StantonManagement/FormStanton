/**
 * audit.ts
 * 
 * Audit row writer for signature capture.
 * Writes immutable audit records to signature_capture_audit table.
 */

import { supabaseAdmin } from '@/lib/supabase';

export type SignerRole = 'tenant' | 'stanton';
export type IdentityMethod = 'magic_link_plus_dob' | 'admin_session';
export type SignatureMethod = 'typed' | 'drawn' | 'typed_and_drawn';
export type DeliveryMethod = 'email' | 'portal_download' | 'both';

export interface AuditRowParams {
  packetSignatureId: string;
  signerUserId?: string | null;
  signerTenantToken?: string | null;
  signerDisplayName: string;
  signerRole: SignerRole;
  consentRecordedAt: Date;
  consentTextVersion: string;
  consentLanguage: string;
  identityMethod: IdentityMethod;
  identityVerifiedAt: Date;
  documentReviewedAt: Date;
  pagesViewed: number;
  pdfPageCount: number;
  signatureMethod: SignatureMethod;
  typedName: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
  originalPdfPath: string;
  originalDocumentHash: string;
  signedPdfPath: string;
  signedDocumentHash: string;
  deliveredToSignerAt?: Date | null;
  deliveryMethod?: DeliveryMethod | null;
  deliveryAddress?: string | null;
}

/**
 * Write an audit row to signature_capture_audit.
 * This should be called within a transaction along with packet_signatures update.
 * The audit table is immutable - no UPDATE or DELETE policies exist.
 */
export async function writeAuditRow(
  params: AuditRowParams
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('signature_capture_audit')
    .insert({
      packet_signature_id: params.packetSignatureId,
      signer_user_id: params.signerUserId ?? null,
      signer_tenant_token: params.signerTenantToken ?? null,
      signer_display_name: params.signerDisplayName,
      signer_role: params.signerRole,
      consent_recorded_at: params.consentRecordedAt.toISOString(),
      consent_text_version: params.consentTextVersion,
      consent_language: params.consentLanguage,
      identity_method: params.identityMethod,
      identity_verified_at: params.identityVerifiedAt.toISOString(),
      document_reviewed_at: params.documentReviewedAt.toISOString(),
      pages_viewed: params.pagesViewed,
      pdf_page_count: params.pdfPageCount,
      signature_method: params.signatureMethod,
      typed_name: params.typedName,
      signed_at: params.signedAt.toISOString(),
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      original_pdf_path: params.originalPdfPath,
      original_document_hash: params.originalDocumentHash,
      signed_pdf_path: params.signedPdfPath,
      signed_document_hash: params.signedDocumentHash,
      delivered_to_signer_at: params.deliveredToSignerAt?.toISOString() ?? null,
      delivery_method: params.deliveryMethod ?? null,
      delivery_address: params.deliveryAddress ?? null,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to write audit row: ${error.message}`);
  }

  return data.id;
}

/**
 * Load audit row for a signature (for viewing audit trail)
 */
export async function loadAuditForSignature(
  packetSignatureId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin
    .from('signature_capture_audit')
    .select('*')
    .eq('packet_signature_id', packetSignatureId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load audit: ${error.message}`);
  }

  return data;
}
