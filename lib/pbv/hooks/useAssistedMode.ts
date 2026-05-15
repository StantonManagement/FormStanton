'use client';

/**
 * lib/pbv/hooks/useAssistedMode.ts
 *
 * Detects whether a staff-assisted session is active for the given application.
 * Calls GET /api/t/[token]/pbv-full-app/assisted-mode on mount (and on focus).
 *
 * Returns:
 *   { assisted: null }           — still loading
 *   { assisted: false }          — no active session
 *   { assisted: AssistedInfo }   — active session
 *   endSession()                 — calls DELETE on the assisted-session route
 */

import { useState, useEffect, useCallback } from 'react';

export interface AssistedInfo {
  staffDisplayName: string;
  staffUserId: string;
  startedAt: string;
  applicationId: string;
}

interface UseAssistedModeReturn {
  assisted: AssistedInfo | null | false;
  ending: boolean;
  endSession: () => Promise<void>;
  refresh: () => void;
}

export function useAssistedMode(token: string): UseAssistedModeReturn {
  const [assisted, setAssisted] = useState<AssistedInfo | null | false>(null);
  const [ending, setEnding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/t/${token}/pbv-full-app/assisted-mode`, { cache: 'no-store' });
      if (!res.ok) { setAssisted(false); return; }
      const json = await res.json();
      if (json.active) {
        setAssisted({
          staffDisplayName: json.staffDisplayName,
          staffUserId: json.staffUserId,
          startedAt: json.startedAt,
          applicationId: json.applicationId,
        });
      } else {
        setAssisted(false);
      }
    } catch {
      setAssisted(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const endSession = useCallback(async () => {
    if (ending || !assisted) return;
    const appId = typeof assisted === 'object' ? assisted.applicationId : null;
    if (!appId) return;
    setEnding(true);
    try {
      await fetch(`/api/admin/pbv/full-applications/${appId}/assisted-session`, {
        method: 'DELETE',
      });
      setAssisted(false);
    } finally {
      setEnding(false);
    }
  }, [assisted, ending]);

  return { assisted, ending, endSession, refresh };
}
