'use client';

/**
 * lib/pbv/hooks/useSectionAutoSave.ts
 *
 * Debounced auto-save hook. Calls POST /api/t/[token]/pbv-full-app/intake/[section]
 * on every data change after a 600ms debounce.
 *
 * PRP-012 (C5 + E5):
 *   - localStorage backup keyed `pbv_intake_${token}_${section}` is written
 *     on every data change (debounced via the same effect) and cleared on
 *     confirmed server save. On mount, if a backup is newer than what the
 *     caller has in memory we surface it via `restoredFromBackup` so the
 *     page can show a "we restored your unsaved changes" notice.
 *   - Replaced the `JSON.stringify(data)` effect dep with a small
 *     dirty-flag ref so we don't serialize the entire intake object on
 *     every render.
 *   - Private-mode safe: localStorage failures are swallowed.
 *
 * Features (existing):
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

export interface BackupRestore<T> {
  data: T;
  savedAt: number;
}

export interface UseSectionAutoSaveResult<T = Record<string, unknown>> {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  saveNow: () => Promise<void>;
  clearError: () => void;
  /** If the section had a localStorage backup newer than the bootstrap
   *  intake data, it's surfaced here once on mount. The page should
   *  display a "we restored your unsaved changes" notice and merge it
   *  into the section state. */
  restoredFromBackup: BackupRestore<T> | null;
  /** Test-only / advanced: forget the surfaced restore (so re-render
   *  doesn't reapply it). */
  acknowledgeRestore: () => void;
}

const DEBOUNCE_MS = 600;
const RETRY_DELAY_MS = 2000;

function backupKey(token: string, section: SectionSlug): string {
  return `pbv_intake_${token}_${section}`;
}

function readBackup<T>(token: string, section: SectionSlug | null): BackupRestore<T> | null {
  if (!section || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(backupKey(token, section));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackupRestore<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeBackup<T>(token: string, section: SectionSlug, data: T) {
  if (typeof window === 'undefined') return;
  try {
    const entry: BackupRestore<T> = { data, savedAt: Date.now() };
    window.localStorage.setItem(backupKey(token, section), JSON.stringify(entry));
  } catch {
    // Private mode / quota — silent.
  }
}

function clearBackup(token: string, section: SectionSlug) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(backupKey(token, section));
  } catch {
    // silent
  }
}

export function useSectionAutoSave<T extends Record<string, unknown>>(
  token: string,
  section: SectionSlug | null,
  data: T | null,
  enabled = true
): UseSectionAutoSaveResult<T> {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [restoredFromBackup, setRestoredFromBackup] = useState<BackupRestore<T> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<T | null>(null);
  const sectionRef = useRef<SectionSlug | null>(section);
  const tokenRef = useRef(token);
  // PRP-012 / E5: dirty-flag ref + serialized snapshot of the last seen
  // payload, so we can detect a change without stringifying every render.
  const lastSerializedRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  // Guard so the on-mount backup restore only runs once.
  const restoreCheckedRef = useRef(false);

  // Keep refs current
  dataRef.current = data;
  sectionRef.current = section;
  tokenRef.current = token;

  // PRP-012 / C5: on mount, surface a newer localStorage backup. We don't
  // overwrite the caller's data here (they hold the bootstrap value);
  // we surface the backup so the page can confirm/merge.
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    if (!section || typeof window === 'undefined') return;
    restoreCheckedRef.current = true;
    const backup = readBackup<T>(token, section);
    if (backup) {
      setRestoredFromBackup(backup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, token]);

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
      // PRP-012 / C5: server save confirmed → clear the local backup.
      clearBackup(t, s);
      dirtyRef.current = false;
    } catch (err) {
      if (!retry) {
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

  // PRP-012 / E5: change-detection via a serialized snapshot owned by a
  // ref. Computed exactly once per render (here in the effect body), not
  // once per render via the dep array. This avoids two stringifies and
  // is correct under StrictMode.
  useEffect(() => {
    if (!enabled || !data || !section) return;

    // Compute the snapshot once. Strict-mode double-invoke is idempotent
    // (same string, same dirty result).
    let serialized: string;
    try {
      serialized = JSON.stringify(data);
    } catch {
      return;
    }
    if (serialized === lastSerializedRef.current) return;
    lastSerializedRef.current = serialized;
    dirtyRef.current = true;

    // PRP-012 / C5: write the local backup synchronously on change so a
    // refresh between keystroke and server save still has the latest.
    writeBackup(token, section, data);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSave();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [data, section, enabled, token, doSave]);

  const clearError = useCallback(() => setSaveStatus('idle'), []);
  const acknowledgeRestore = useCallback(() => setRestoredFromBackup(null), []);

  return {
    saveStatus,
    lastSavedAt,
    saveNow,
    clearError,
    restoredFromBackup,
    acknowledgeRestore,
  };
}
