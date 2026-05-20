'use client';

/**
 * lib/pbv/hooks/useAdditionalSigners.ts
 *
 * Fetches non-HOH adults and their signing status from
 * GET /api/t/[token]/pbv-full-app/additional-signers.
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';

export interface AdditionalSigner {
  member_id: string;
  slot: number;
  name: string;
  age: number | null;
  has_signed: boolean;
  magic_link_generated: boolean;
  magic_link_expires_at: string | null;
  signing_device: string;
}

export type AdditionalSignersState =
  | { status: 'loading' }
  | { status: 'ready'; signers: AdditionalSigner[]; pending_count: number }
  | { status: 'error'; message: string };

export function useAdditionalSigners(token: string) {
  const [state, setState] = useState<AdditionalSignersState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) return;
    setState({ status: 'loading' });
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/additional-signers`);
      if (!res.ok) throw new Error('Failed to load additional signers.');
      const json = await res.json();
      setState({
        status: 'ready',
        signers: json.data?.signers ?? [],
        pending_count: json.data?.pending_count ?? 0,
      });
    } catch (err: any) {
      setState({ status: 'error', message: err.message || 'Failed to load.' });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { state, reload: load };
}
