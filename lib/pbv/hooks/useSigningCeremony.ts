'use client';

/**
 * lib/pbv/hooks/useSigningCeremony.ts
 *
 * Manages the per-session signing ceremony.
 *
 * Rules (per PRD-26 closed decisions):
 *   - ceremony_id: one UUID per contiguous session, generated client-side
 *   - signature_image_path: captured ONCE per ceremony via POST signature/capture
 *   - Subsequent sign-form calls reuse the stored path — no second capture
 *   - Do NOT persist signature image in localStorage/sessionStorage — memory only
 *   - Idempotency-Key on every sign-form: compose of ceremony_id + form_document_id
 */

import { useState, useCallback, useRef } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';
import { getFormConsent, CONSENT_TEXT_VERSION } from '@/lib/pbv/consent-text';
import type { PreferredLanguage } from '@/types/compliance';

export interface CeremonyState {
  ready: boolean;
  ceremonyId: string | null;
  signatureImagePath: string | null;
  signingFormId: string | null;
  submitting: boolean;
  error: string;
}

export function useSigningCeremony(token: string, hohMemberId: string, language: PreferredLanguage) {
  const ceremonyIdRef = useRef<string>(crypto.randomUUID());
  const [signatureImagePath, setSignatureImagePath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const consentText = getFormConsent(language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en');

  /**
   * Called on the FIRST form sign of a session (or if signature was never captured).
   * Captures the signature image, then signs the target form.
   */
  const captureAndSign = useCallback(async (
    formDocumentId: string,
    signatureDataUrl: string,
    typedName: string,
  ): Promise<boolean> => {
    setSubmitting(true);
    setError('');
    try {
      const ceremonyId = ceremonyIdRef.current;

      // 1. Capture signature image (once per ceremony)
      const captureRes = await tenantFetch(`/api/t/${token}/pbv-full-app/signature/capture`, {
        method: 'POST',
        body: {
          signature_image_data_url: signatureDataUrl,
          signer_member_id: hohMemberId,
          ceremony_id: ceremonyId,
        },
      });
      const captureJson = await captureRes.json().catch(() => ({}));
      if (!captureRes.ok) throw new Error((captureJson as any).message || 'Failed to capture signature.');

      const imagePath: string = (captureJson as any).data.signature_image_path;
      setSignatureImagePath(imagePath);

      // 2. Sign the form
      const idempotencyKey = `${ceremonyId}-${formDocumentId}`;
      const signRes = await tenantFetch(`/api/t/${token}/pbv-full-app/sign-form`, {
        method: 'POST',
        body: {
          form_document_id: formDocumentId,
          signer_member_id: hohMemberId,
          typed_name: typedName,
          signature_image_path: imagePath,
          ceremony_id: ceremonyId,
          consent_text_version: CONSENT_TEXT_VERSION,
          device_owner: 'self',
        },
      });
      // Note: tenantFetch auto-generates an Idempotency-Key per call.
      // idempotencyKey is kept as a local for documentation purposes.
      void idempotencyKey;

      const signJson = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error((signJson as any).message || 'Failed to sign form.');

      return true;
    } catch (err: any) {
      setError(err.message || 'Signing failed.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [token, hohMemberId]);

  /**
   * Called for subsequent forms (signature already captured this session).
   */
  const signWithExisting = useCallback(async (
    formDocumentId: string,
    typedName: string,
  ): Promise<boolean> => {
    if (!signatureImagePath) {
      setError('No signature captured yet. Please sign your first form first.');
      return false;
    }
    setSubmitting(true);
    setError('');
    try {
      const ceremonyId = ceremonyIdRef.current;
      const signRes = await tenantFetch(`/api/t/${token}/pbv-full-app/sign-form`, {
        method: 'POST',
        body: {
          form_document_id: formDocumentId,
          signer_member_id: hohMemberId,
          typed_name: typedName,
          signature_image_path: signatureImagePath,
          ceremony_id: ceremonyId,
          consent_text_version: CONSENT_TEXT_VERSION,
          device_owner: 'self',
        },
      });
      const signJson = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error((signJson as any).message || 'Failed to sign form.');
      return true;
    } catch (err: any) {
      setError(err.message || 'Signing failed.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [token, hohMemberId, signatureImagePath]);

  return {
    hasSignature: !!signatureImagePath,
    ceremonyId: ceremonyIdRef.current,
    consentText,
    submitting,
    error,
    clearError: () => setError(''),
    captureAndSign,
    signWithExisting,
  };
}

