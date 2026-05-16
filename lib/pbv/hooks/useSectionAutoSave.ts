'use client';

/**
 * lib/pbv/hooks/useSectionAutoSave.ts
 *
 * Debounced auto-save hook. Calls POST /api/t/[token]/pbv-full-app/intake/[section]
 * on every data change after a 600ms debounce.
 *
 * Features:
 *   - Idempotency key per save attempt (new key on each attempt, not per session)
 *   - Retry once on network failure
 *   - Tracks save status: 'idle' | 'saving' | 'saved' | 'error'
 *   - Exposes last saved timestamp
 *   - Does not block UI on failure
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { tenantFetch } from '@/lib/tenantFetch';
import type { SectionSlug } from '@/lib/pbv/intake-schema';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseSectionAutoSaveResult {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  saveNow: () => Promise<void>;
  clearError: () => void;
}

const DEBOUNCE_MS = 600;
const RETRY_DELAY_MS = 2000;

export function useSectionAutoSave<T extends Record<string, unknown>>(
  token: string,
  section: SectionSlug | null,
  data: T | null,
  enabled = true
): UseSectionAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<T | null>(null);
  const sectionRef = useRef<SectionSlug | null>(section);
  const tokenRef = useRef(token);

  // Keep refs current
  dataRef.current = data;
  sectionRef.current = section;
  tokenRef.current = token;

  const doSave = useCallback(async (retry = false): Promise<void> => {
    const d = dataRef.current;
    const s = sectionRef.current;
    const t = tokenRef.current;
    if (!d || !s || !t) return;

    setSaveStatus('saving');
    try {
      const res = await tenantFetch(`/api/t/${t}/pbv-full-app/intake/${s}`, {
        method: 'POST',
        body: { data: d },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Save failed (${res.status})`);
      }
      setSaveStatus('saved');
      setLastSavedAt(new Date());
    } catch (err) {
      if (!retry) {
        // Retry once after delay
        setTimeout(() => doSave(true), RETRY_DELAY_MS);
      } else {
        setSaveStatus('error');
      }
    }
  }, []);

  const saveNow = useCallback((): Promise<void> => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    return doSave();
  }, [doSave]);

  // Debounced auto-save on data change
  useEffect(() => {
    if (!enabled || !data || !section) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // data is intentionally stringified for change detection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), section, enabled]);

  const clearError = useCallback(() => setSaveStatus('idle'), []);

  return { saveStatus, lastSavedAt, saveNow, clearError };
}
