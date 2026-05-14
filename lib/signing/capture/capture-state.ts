/**
 * capture-state.ts
 * 
 * Server-side state machine for signature capture flow.
 * Uses signature_capture_in_progress table with 30-minute TTL.
 * 
 * Rationale for TTL table vs session storage:
 * - Stateless: works across server restarts and load balancing
 * - Serializable: can be inspected and debugged
 * - Self-cleaning: expired rows auto-cleanup
 * - Atomic: can participate in transactions
 */

import { supabaseAdmin } from '@/lib/supabase';

export type CaptureStep = 'consent' | 'identity' | 'review' | 'signature' | 'complete';
export type SignerRole = 'tenant' | 'stanton';

export interface CaptureState {
  id: string;
  packetSignatureId: string;
  signerRole: SignerRole;
  tenantToken: string | null;
  step: CaptureStep;
  consentRecordedAt: Date | null;
  consentVersion: string | null;
  consentLanguage: string | null;
  identityVerifiedAt: Date | null;
  identityAttempts: number;
  lockedUntil: Date | null;
  documentReviewedAt: Date | null;
  pagesViewed: number | null;
  pdfPageCount: number | null;
  originalPdfPath: string | null;
  originalPdfHash: string | null;
  typedName: string | null;
  signatureImageDataUrl: string | null;
  signatureDate: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}

/**
 * Get or create a capture state for a signature.
 */
export async function getOrCreateCaptureState(
  packetSignatureId: string,
  signerRole: SignerRole,
  tenantToken: string | null,
  ipAddress: string,
  userAgent: string
): Promise<CaptureState> {
  // Try to find existing state
  const { data: existing } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .select('*')
    .eq('packet_signature_id', packetSignatureId)
    .eq('signer_role', signerRole)
    .is('tenant_token', tenantToken)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return mapRowToState(existing);
  }

  // Create new state
  const { data: created, error } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .insert({
      packet_signature_id: packetSignatureId,
      signer_role: signerRole,
      tenant_token: tenantToken,
      step: 'consent',
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(`Failed to create capture state: ${error?.message}`);
  }

  return mapRowToState(created);
}

/**
 * Load existing capture state.
 */
export async function loadCaptureState(
  stateId: string
): Promise<CaptureState | null> {
  const { data } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .select('*')
    .eq('id', stateId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  return data ? mapRowToState(data) : null;
}

/**
 * Record consent step completion.
 */
export async function recordConsent(
  stateId: string,
  version: string,
  language: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .update({
      step: 'identity',
      consent_recorded_at: new Date().toISOString(),
      consent_version: version,
      consent_language: language,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', stateId);

  if (error) {
    throw new Error(`Failed to record consent: ${error.message}`);
  }
}

/**
 * Record identity verification completion.
 */
export async function recordIdentityVerified(
  stateId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .update({
      step: 'review',
      identity_verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', stateId);

  if (error) {
    throw new Error(`Failed to record identity: ${error.message}`);
  }
}

/**
 * Record document review completion.
 */
export async function recordDocumentReviewed(
  stateId: string,
  pagesViewed: number,
  pdfPageCount: number,
  originalPdfPath: string,
  originalPdfHash: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .update({
      step: 'signature',
      document_reviewed_at: new Date().toISOString(),
      pages_viewed: pagesViewed,
      pdf_page_count: pdfPageCount,
      original_pdf_path: originalPdfPath,
      original_pdf_hash: originalPdfHash,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', stateId);

  if (error) {
    throw new Error(`Failed to record document review: ${error.message}`);
  }
}

/**
 * Record signature capture (before apply).
 */
export async function recordSignatureCaptured(
  stateId: string,
  typedName: string,
  signatureImageDataUrl: string,
  date: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .update({
      step: 'complete',
      typed_name: typedName,
      signature_image_data_url: signatureImageDataUrl,
      signature_date: date,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .eq('id', stateId);

  if (error) {
    throw new Error(`Failed to record signature: ${error.message}`);
  }
}

/**
 * Delete capture state after successful apply.
 */
export async function deleteCaptureState(stateId: string): Promise<void> {
  await supabaseAdmin
    .from('signature_capture_in_progress')
    .delete()
    .eq('id', stateId);
}

/**
 * Check if the original PDF has changed (tamper check).
 */
export async function verifyOriginalPdfUnchanged(
  stateId: string,
  currentHash: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .select('original_pdf_hash')
    .eq('id', stateId)
    .single();

  if (!data?.original_pdf_hash) {
    return false;
  }

  return data.original_pdf_hash === currentHash;
}

/**
 * Map database row to CaptureState interface.
 */
function mapRowToState(row: Record<string, unknown>): CaptureState {
  return {
    id: row.id as string,
    packetSignatureId: row.packet_signature_id as string,
    signerRole: row.signer_role as SignerRole,
    tenantToken: row.tenant_token as string | null,
    step: row.step as CaptureStep,
    consentRecordedAt: row.consent_recorded_at ? new Date(row.consent_recorded_at as string) : null,
    consentVersion: row.consent_version as string | null,
    consentLanguage: row.consent_language as string | null,
    identityVerifiedAt: row.identity_verified_at ? new Date(row.identity_verified_at as string) : null,
    identityAttempts: (row.identity_attempts as number) ?? 0,
    lockedUntil: row.locked_until ? new Date(row.locked_until as string) : null,
    documentReviewedAt: row.document_reviewed_at ? new Date(row.document_reviewed_at as string) : null,
    pagesViewed: row.pages_viewed as number | null,
    pdfPageCount: row.pdf_page_count as number | null,
    originalPdfPath: row.original_pdf_path as string | null,
    originalPdfHash: row.original_pdf_hash as string | null,
    typedName: row.typed_name as string | null,
    signatureImageDataUrl: row.signature_image_data_url as string | null,
    signatureDate: row.signature_date ? new Date(row.signature_date as string) : null,
    ipAddress: row.ip_address as string | null,
    userAgent: row.user_agent as string | null,
    expiresAt: new Date(row.expires_at as string),
  };
}
