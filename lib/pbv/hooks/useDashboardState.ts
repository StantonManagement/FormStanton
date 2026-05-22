'use client';

/**
 * lib/pbv/hooks/useDashboardState.ts
 *
 * Bootstraps dashboard card states from the PRD-24 bootstrap GET endpoint
 * plus the forms list endpoint. Derives per-card status without duplicating
 * the signing-state machine on the client.
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';
import { safeTenantErrorMessage } from '@/lib/pbv/safeErrorMessage';
import type { SigningStatus } from './useIntakeBootstrap';
import type { PreferredLanguage } from '@/types/compliance';

export interface FormDoc {
  id: string;
  form_id: string;
  display_name: string;
  status: string;
  signatures_complete: boolean;
}

export interface DashboardData {
  preferred_language: PreferredLanguage;
  submission_language: 'en' | 'es';
  signing_status: SigningStatus;
  head_of_household_name: string;
  hoh_member_id: string | null;
  summary_signed: boolean;
  forms: FormDoc[];
  forms_total: number;
  forms_signed: number;
  upload_total: number;
  upload_complete: number;
  optional_uploaded_count: number;
  additional_signers_needed: boolean;
  additional_signers_pending_count: number;
  can_submit: boolean;
  // PRD-36: Application review status fields
  application_review_status: string | null;
  application_review_status_at: string | null;
  application_review_status_note: string | null;
  rejected_documents_count: number;
  intake_status: string | null;
  // PRD-36: For office contact lookup
  building_address: string | null;
  // PRD-58: True submission state (Phase 1)
  submitted_at: string | null;
}

/** PRP-011 / C3: per-slice fetch status so the dashboard can render
 *  partial data + a warning instead of failing the whole page on one bad
 *  slice. */
export interface DashboardSliceStatus {
  forms: 'ok' | 'failed';
  upload: 'ok' | 'failed' | 'fallback';
  signers: 'ok' | 'failed';
}

export type DashboardState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardData; slices?: DashboardSliceStatus }
  | { status: 'error'; message: string };

export function useDashboardState(token: string) {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) return;
    setState({ status: 'loading' });

    try {
      // PRP-011 / C3: Promise.allSettled so one rejected slice doesn't
      // fail the entire dashboard. Bootstrap is still load-bearing
      // (everything keys off its language/signing_status/etc); the other
      // three slices degrade to defaults + a per-slice warning.
      const [bootstrapSettled, formsSettled, uploadSettled, signersSettled] = await Promise.allSettled([
        tenantFetch(`/api/t/${token}/pbv-full-app`),
        tenantFetch(`/api/t/${token}/pbv-full-app/forms`),
        tenantFetch(`/api/t/${token}/pbv-full-app/upload-summary`),
        tenantFetch(`/api/t/${token}/pbv-full-app/additional-signers`),
      ]);

      if (bootstrapSettled.status === 'rejected' || !bootstrapSettled.value.ok) {
        const msg =
          bootstrapSettled.status === 'rejected'
            ? (bootstrapSettled.reason instanceof Error ? bootstrapSettled.reason.message : 'Network error')
            : 'Failed to load application state.';
        throw new Error(msg);
      }
      const bootstrapRes = bootstrapSettled.value;
      const bootstrap = await bootstrapRes.json();
      const d = bootstrap.data ?? bootstrap;

      const slices: DashboardSliceStatus = { forms: 'ok', upload: 'ok', signers: 'ok' };

      let forms: FormDoc[] = [];
      if (formsSettled.status === 'fulfilled' && formsSettled.value.ok) {
        const formsJson = await formsSettled.value.json().catch(() => ({}));
        forms = (formsJson as any).data?.forms ?? [];
      } else {
        slices.forms = 'failed';
      }

      const signingStatus: SigningStatus = (d.signing_status ?? 'not_started') as SigningStatus;
      const summarySignedStatuses: SigningStatus[] = ['summary_signed', 'in_progress', 'complete'];
      const summarySign = summarySignedStatuses.includes(signingStatus);

      const formsSigned = forms.filter((f) => f.signatures_complete).length;
      const formsTotal = forms.length;

      let uploadTotal = 0;
      let uploadComplete = 0;
      let optionalUploadedCount = 0;
      if (uploadSettled.status === 'fulfilled' && uploadSettled.value.ok) {
        const uploadJson = await uploadSettled.value.json().catch(() => ({}));
        uploadTotal = (uploadJson as any).data?.total ?? 0;
        uploadComplete = (uploadJson as any).data?.complete ?? 0;
        optionalUploadedCount = (uploadJson as any).data?.optional_complete ?? 0;
      } else {
        // Fallback to bootstrap document_summary if upload-summary endpoint unavailable.
        const uploadSummary = d.document_summary ?? {};
        uploadTotal = (uploadSummary.total ?? 0) as number;
        uploadComplete = (uploadSummary.complete ?? 0) as number;
        optionalUploadedCount = 0;
        slices.upload = uploadSettled.status === 'fulfilled' ? 'failed' : 'fallback';
      }

      let additionalSignersPendingCount = 0;
      if (signersSettled.status === 'fulfilled' && signersSettled.value.ok) {
        const signersJson = await signersSettled.value.json().catch(() => ({}));
        additionalSignersPendingCount = (signersJson as any).data?.pending_count ?? 0;
      } else {
        slices.signers = 'failed';
      }

      const canSubmit =
        summarySign &&
        formsTotal > 0 &&
        formsSigned >= formsTotal &&
        uploadTotal > 0 &&
        uploadComplete >= uploadTotal &&
        additionalSignersPendingCount === 0;

      setState({
        status: 'ready',
        slices,
        data: {
          preferred_language: (d.preferred_language ?? 'en') as PreferredLanguage,
          submission_language: (d.submission_language ?? 'en') as 'en' | 'es',
          signing_status: signingStatus,
          head_of_household_name: d.head_of_household_name ?? '',
          hoh_member_id: d.hoh_member_id ?? null,
          summary_signed: summarySign,
          forms,
          forms_total: formsTotal,
          forms_signed: formsSigned,
          upload_total: uploadTotal,
          upload_complete: uploadComplete,
          optional_uploaded_count: optionalUploadedCount,
          additional_signers_needed: additionalSignersPendingCount > 0,
          additional_signers_pending_count: additionalSignersPendingCount,
          can_submit: canSubmit,
          // PRD-36: Application review status fields from bootstrap
          application_review_status: (d.application_review_status as string | null) ?? null,
          application_review_status_at: (d.application_review_status_at as string | null) ?? null,
          application_review_status_note: (d.application_review_status_note as string | null) ?? null,
          rejected_documents_count: (d.rejected_documents_count as number) ?? 0,
          intake_status: (d.intake_status as string | null) ?? null,
          building_address: (d.building_address as string | null) ?? null,
          // PRD-58: True submission state (Phase 1)
          submitted_at: (d.submitted_at as string | null) ?? null,
        },
      });
    } catch (err: any) {
      console.error('[useDashboardState] load failed:', err);
      setState({ status: 'error', message: safeTenantErrorMessage(err, 'Failed to load dashboard.') });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { state, reload: load };
}
