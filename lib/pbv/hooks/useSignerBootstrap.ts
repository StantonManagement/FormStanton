'use client';

/**
 * lib/pbv/hooks/useSignerBootstrap.ts
 *
 * Bootstrap for a non-HOH adult's magic-link signing session.
 * Fetches GET /api/pbv-full-app/signer/[member_token].
 * Handles 410 (expired) and 404 (not found) explicitly.
 */

import { useState, useEffect } from 'react';

export interface SignerBootstrapData {
  member_id: string;
  member_name: string;
  slot: number;
  preferred_language: 'en' | 'es' | 'pt';
  hoh_name: string;
  application_id: string;
  magic_link_expires_at: string;
}

export type SignerBootstrapState =
  | { status: 'loading' }
  | { status: 'ready'; data: SignerBootstrapData }
  | { status: 'expired' }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export function useSignerBootstrap(memberToken: string) {
  const [state, setState] = useState<SignerBootstrapState>({ status: 'loading' });

  useEffect(() => {
    if (!memberToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pbv-full-app/signer/${memberToken}`);
        if (cancelled) return;
        if (res.status === 410) { setState({ status: 'expired' }); return; }
        if (res.status === 404) { setState({ status: 'not_found' }); return; }
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const json = await res.json();
        setState({ status: 'ready', data: json.data });
      } catch (err: any) {
        if (!cancelled) setState({ status: 'error', message: err.message || 'Failed to load.' });
      }
    })();
    return () => { cancelled = true; };
  }, [memberToken]);

  return state;
}
