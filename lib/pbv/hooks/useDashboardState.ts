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

export type DashboardState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardData }
  | { status: 'error'; message: string };

export function useDashboardState(token: string) {
  const [state, setState] = useState<DashboardState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) return;
    setState({ status: 'loading' });

    try {
      const [bootstrapRes, formsRes, uploadRes, signersRes] = await Promise.all([
        tenantFetch(`/api/t/${token}/pbv-full-app`),
        tenantFetch(`/api/t/${token}/pbv-full-app/forms`),
        tenantFetch(`/api/t/${token}/pbv-full-app/upload-summary`),
        tenantFetch(`/api/t/${token}/pbv-full-app/additional-signers`),
      ]);

      if (!bootstrapRes.ok) throw new Error('Failed to load application state.');
      const bootstrap = await bootstrapRes.json();
      const d = bootstrap.data ?? bootstrap;

      let forms: FormDoc[] = [];
      if (formsRes.ok) {
        const formsJson = await formsRes.json();
        forms = formsJson.data?.forms ?? [];
      }

      const signingStatus: SigningStatus = (d.signing_status ?? 'not_started') as SigningStatus;
      const summarySignedStatuses: SigningStatus[] = ['summary_signed', 'in_progress', 'complete'];
      const summarySign = summarySignedStatuses.includes(signingStatus);

      const formsSigned = forms.filter((f) => f.signatures_complete).length;
      const formsTotal = forms.length;

      let uploadTotal = 0;
      let uploadComplete = 0;
      let optionalUploadedCount = 0;
      if (uploadRes.ok) {
        const uploadJson = await uploadRes.json();
        uploadTotal = uploadJson.data?.total ?? 0;
        uploadComplete = uploadJson.data?.complete ?? 0;
        optionalUploadedCount = uploadJson.data?.optional_complete ?? 0;
      } else {
        // Fallback to bootstrap document_summary if upload-summary endpoint unavailable
        const uploadSummary = d.document_summary ?? {};
        uploadTotal = (uploadSummary.total ?? 0) as number;
        uploadComplete = (uploadSummary.complete ?? 0) as number;
        optionalUploadedCount = 0;
      }

      let additionalSignersPendingCount = 0;
      if (signersRes.ok) {
        const signersJson = await signersRes.json().catch(() => ({}));
        additionalSignersPendingCount = (signersJson as any).data?.pending_count ?? 0;
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
