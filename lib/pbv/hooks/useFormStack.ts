'use client';

/**
 * lib/pbv/hooks/useFormStack.ts
 *
 * Fetches the generated pbv_form_documents list for the signing ceremony.
 * Provides reload() so the UI can refresh after each sign-form call.
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';

export interface FormDoc {
  id: string;
  form_id: string;
  display_name: string;
  language: string;
  status: string;
  generated_at: string | null;
  finalized_at: string | null;
  required_signer_count: number;
  collected_signer_count: number;
  signatures_complete: boolean;
  conditional_trigger: string | null;
}

export type FormStackState =
  | { status: 'loading' }
  | { status: 'ready'; forms: FormDoc[] }
  | { status: 'error'; message: string };

export function useFormStack(token: string) {
  const [state, setState] = useState<FormStackState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) return;
    setState({ status: 'loading' });
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/forms`);
      if (!res.ok) throw new Error('Failed to load forms.');
      const json = await res.json();
      setState({ status: 'ready', forms: json.data?.forms ?? [] });
    } catch (err: any) {
      setState({ status: 'error', message: err.message || 'Failed to load forms.' });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { state, reload: load };
}
