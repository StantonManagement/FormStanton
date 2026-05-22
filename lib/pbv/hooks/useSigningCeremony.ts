'use client';

/**
 * lib/pbv/hooks/useSigningCeremony.ts
 *
 * Manages the per-session signing ceremony.
 *
 * Rules (per PRD-26 closed decisions + PRP-012 update):
 *   - ceremony_id: one UUID per contiguous session, generated client-side.
 *     Persisted in sessionStorage so a refresh / modal re-open keeps the
 *     same ceremony, and the same composed idempotency key collapses any
 *     server-side replay.
 *   - signature_image_path: captured ONCE per ceremony via POST signature/capture.
 *     PRP-012 persists the PATH (not the image bytes) in sessionStorage so a
 *     refresh reuses the captured signature without forcing a redraw. Cleared
 *     on completion (or on explicit reset).
 *   - Idempotency-Key on every sign-form: composed of `${ceremonyId}-${formDocumentId}`,
 *     now actually passed to tenantFetch (was discarded pre-PRP-012). This makes
 *     server-side withIdempotency collapse a retry of the same form into one
 *     write — critical for the C2 backoff path in PRP-011.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

const ceremonyStorageKey = (token: string) => `pbv_ceremony_${token}`;

interface PersistedCeremony {
  ceremonyId: string;
  signatureImagePath: string | null;
}

function readCeremony(token: string): PersistedCeremony | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ceremonyStorageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCeremony;
    if (!parsed?.ceremonyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCeremony(token: string, payload: PersistedCeremony) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ceremonyStorageKey(token), JSON.stringify(payload));
  } catch {
    // private mode / quota — silent
  }
}

function clearCeremony(token: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ceremonyStorageKey(token));
  } catch {
    // silent
  }
}

export function useSigningCeremony(token: string, hohMemberId: string, language: PreferredLanguage) {
  // PRP-012 / C6: rehydrate ceremonyId + signatureImagePath from
  // sessionStorage so a refresh mid-ceremony keeps the same identity and
  // does not force a re-capture.
  const ceremonyIdRef = useRef<string>('');
  const [signatureImagePath, setSignatureImagePath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const rehydratedRef = useRef(false);

  if (!ceremonyIdRef.current) {
    const persisted = readCeremony(token);
    if (persisted) {
      ceremonyIdRef.current = persisted.ceremonyId;
    } else {
      ceremonyIdRef.current = crypto.randomUUID();
      writeCeremony(token, { ceremonyId: ceremonyIdRef.current, signatureImagePath: null });
    }
  }

  // Surface the persisted signatureImagePath into state on mount.
  useEffect(() => {
    if (rehydratedRef.current) return;
    rehydratedRef.current = true;
    const persisted = readCeremony(token);
    if (persisted?.signatureImagePath) {
      setSignatureImagePath(persisted.signatureImagePath);
    }
  }, [token]);

  const consentText = getFormConsent(language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en');

  const persistSignaturePath = useCallback((path: string | null) => {
    writeCeremony(token, { ceremonyId: ceremonyIdRef.current, signatureImagePath: path });
  }, [token]);

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

      // 1. Capture signature image (once per ceremony).
      const captureRes = await tenantFetch(`/api/t/${token}/pbv-full-app/signature/capture`, {
        method: 'POST',
        body: {
          signature_image_data_url: signatureDataUrl,
          signer_member_id: hohMemberId,
          ceremony_id: ceremonyId,
        },
        // PRP-012 / E2: capture path is keyed by ceremonyId so a retry
        // collapses to one write.
        idempotencyKey: `${ceremonyId}-capture`,
      });
      const captureJson = await captureRes.json().catch(() => ({}));
      const imagePath = (captureJson as any)?.data?.signature_image_path;
      if (!captureRes.ok || !imagePath) throw new Error((captureJson as any)?.message || 'Could not save your signature. Please try again.');

      setSignatureImagePath(imagePath);
      persistSignaturePath(imagePath);

      // 2. Sign the form. PRP-012 / E2: pass the composed key into
      // tenantFetch so retries (PRP-011 backoff) collapse to one write.
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
        idempotencyKey: `${ceremonyId}-${formDocumentId}`,
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
  }, [token, hohMemberId, persistSignaturePath]);

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
        idempotencyKey: `${ceremonyId}-${formDocumentId}`,
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

  /** PRP-012 / C6: explicit completion handler the page calls when the
   *  ceremony finishes — clears the sessionStorage key so a brand-new
   *  ceremony starts on the next page open. */
  const completeCeremony = useCallback(() => {
    clearCeremony(token);
    setSignatureImagePath(null);
    ceremonyIdRef.current = crypto.randomUUID();
    writeCeremony(token, { ceremonyId: ceremonyIdRef.current, signatureImagePath: null });
  }, [token]);

  return {
    hasSignature: !!signatureImagePath,
    ceremonyId: ceremonyIdRef.current,
    consentText,
    submitting,
    error,
    clearError: () => setError(''),
    captureAndSign,
    signWithExisting,
    completeCeremony,
  };
}
