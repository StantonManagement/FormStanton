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
  additional_signers_needed: boolean;
  can_submit: boolean;
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
      const [bootstrapRes, formsRes] = await Promise.all([
        tenantFetch(`/api/t/${token}/pbv-full-app`),
        tenantFetch(`/api/t/${token}/pbv-full-app/forms`),
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

      const uploadSummary = d.document_summary ?? {};
      const uploadTotal = (uploadSummary.total ?? 0) as number;
      const uploadComplete = (uploadSummary.complete ?? 0) as number;

      const canSubmit =
        summarySign &&
        formsTotal > 0 &&
        formsSigned >= formsTotal &&
        uploadTotal > 0 &&
        uploadComplete >= uploadTotal;

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
          additional_signers_needed: false,
          can_submit: canSubmit,
        },
      });
    } catch (err: any) {
      setState({ status: 'error', message: err.message || 'Failed to load dashboard.' });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { state, reload: load };
}
