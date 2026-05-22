// @vitest-environment jsdom
/**
 * PRP-012 / C5 + E5 — useSectionAutoSave localStorage backup + dirty-flag dep.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/tenantFetch', () => ({
  tenantFetch: vi.fn(),
}));

import { tenantFetch } from '@/lib/tenantFetch';
import { useSectionAutoSave } from '@/lib/pbv/hooks/useSectionAutoSave';

const TOKEN = 'tok';
const SECTION = 'household' as any;
const KEY = `pbv_intake_${TOKEN}_${SECTION}`;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function ok() {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

describe('useSectionAutoSave backup behavior (C5)', () => {
  it('writes a localStorage backup on data change', async () => {
    (tenantFetch as any).mockResolvedValue(ok());
    const { rerender } = renderHook(({ data }) => useSectionAutoSave(TOKEN, SECTION, data), {
      initialProps: { data: null as any },
    });
    expect(window.localStorage.getItem(KEY)).toBeNull();
    rerender({ data: { foo: 'bar' } });
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data).toEqual({ foo: 'bar' });
    expect(typeof parsed.savedAt).toBe('number');
  });

  it('clears the localStorage backup after a confirmed server save', async () => {
    (tenantFetch as any).mockResolvedValue(ok());
    const { rerender } = renderHook(({ data }) => useSectionAutoSave(TOKEN, SECTION, data), {
      initialProps: { data: { foo: 'bar' } as any },
    });
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    // Trigger another data change to start the debounce, then advance the
    // fake clock past the debounce + microtasks to let the save resolve.
    rerender({ data: { foo: 'baz' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
      // Flush microtasks from the awaited fetch promise.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('surfaces restoredFromBackup on mount when a backup exists', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ data: { foo: 'restored' }, savedAt: Date.now() }));
    const { result } = renderHook(() => useSectionAutoSave(TOKEN, SECTION, null));
    expect(result.current.restoredFromBackup?.data).toEqual({ foo: 'restored' });
  });

  it('returns null restore when no backup exists', () => {
    const { result } = renderHook(() => useSectionAutoSave(TOKEN, SECTION, null));
    expect(result.current.restoredFromBackup).toBeNull();
  });
});

describe('useSectionAutoSave dirty-flag dep (E5)', () => {
  it('does NOT re-schedule the debounce when the data ref-identity changes but the serialization is the same', async () => {
    (tenantFetch as any).mockResolvedValue(ok());
    const { rerender } = renderHook(({ data }) => useSectionAutoSave(TOKEN, SECTION, data), {
      initialProps: { data: { foo: 'bar' } as any },
    });
    expect((tenantFetch as any).mock.calls.length).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    const callsAfterFirst = (tenantFetch as any).mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);

    // Re-render with structurally-identical data; should NOT trigger a save.
    rerender({ data: { foo: 'bar' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect((tenantFetch as any).mock.calls.length).toBe(callsAfterFirst);
  });
});
