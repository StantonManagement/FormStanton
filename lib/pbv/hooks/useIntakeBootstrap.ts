'use client';

/**
 * lib/pbv/hooks/useIntakeBootstrap.ts
 *
 * Fetches application state from the PRD-24 bootstrap GET endpoint.
 * Returns intake_status, signing_status, language, intake_data, and the
 * application metadata needed to drive the dispatcher.
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';
import type { IntakeData } from '@/lib/pbv/intake-schema';
import type { PreferredLanguage } from '@/types/compliance';

export type IntakeStatus = 'not_started' | 'in_progress' | 'complete';
export type SigningStatus = 'not_started' | 'summary_signed' | 'in_progress' | 'complete';

export interface BootstrapData {
  intake_status: IntakeStatus;
  signing_status: SigningStatus;
  preferred_language: PreferredLanguage;
  submission_language: 'en' | 'es';
  intake_data: IntakeData;
  building_address: string;
  unit_number: string;
  submitted_at: string | null;
  phone_hint: string | null;
  head_of_household_name: string;
}

export type BootstrapState =
  | { status: 'loading' }
  | { status: 'ready'; data: BootstrapData }
  | { status: 'error'; message: string };

export function useIntakeBootstrap(token: string) {
  const [state, setState] = useState<BootstrapState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) return;
    setState({ status: 'loading' });
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'This link is invalid or has expired.');
      }
      const json = await res.json();
      const d = json.data ?? json;

      setState({
        status: 'ready',
        data: {
          intake_status: (d.intake_status ?? 'not_started') as IntakeStatus,
          signing_status: (d.signing_status ?? 'not_started') as SigningStatus,
          preferred_language: (d.preferred_language ?? 'en') as PreferredLanguage,
          submission_language: (d.submission_language ?? 'en') as 'en' | 'es',
          intake_data: (d.intake_data ?? {}) as IntakeData,
          building_address: d.building_address ?? '',
          unit_number: d.unit_number ?? '',
          submitted_at: d.submitted_at ?? null,
          phone_hint: d.phone_hint ?? null,
          head_of_household_name: d.head_of_household_name ?? '',
        },
      });
    } catch (err: any) {
      setState({ status: 'error', message: err.message || 'Something went wrong.' });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { state, reload: load };
}
