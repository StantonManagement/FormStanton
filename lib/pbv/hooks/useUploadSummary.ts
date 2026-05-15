'use client';

/**
 * lib/pbv/hooks/useUploadSummary.ts
 *
 * Fetches upload counts from GET /api/t/[token]/pbv-full-app/upload-summary.
 * Used by the dashboard upload card to show "X of Y uploaded".
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';

export interface UploadSummary {
  total: number;
  complete: number;
  by_category: Record<string, { total: number; complete: number }>;
}

export type UploadSummaryState =
  | { status: 'loading' }
  | { status: 'ready'; data: UploadSummary }
  | { status: 'error'; message: string };

export function useUploadSummary(token: string) {
  const [state, setState] = useState<UploadSummaryState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (!token) return;
    setState({ status: 'loading' });
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/upload-summary`);
      if (!res.ok) throw new Error('Failed to load upload summary.');
      const json = await res.json();
      setState({ status: 'ready', data: json.data });
    } catch (err: any) {
      setState({ status: 'error', message: err.message || 'Failed to load uploads.' });
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return { state, reload: load };
}
