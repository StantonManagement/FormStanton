/**
 * PRD-70: tenant-flow-handlers unit tests.
 *
 * Gates from PRD-70 prompt:
 *  - Gate 1: unit PATCH !ok / throw → error rendered AND router.push NOT called;
 *    success → router.push IS called.
 *  - Gate 2: documents data-fetch error → calls refetch (not reload); bootstrap
 *    error still uses reload (PRD-67's intentional behavior).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  attemptUnitSaveAndDecide,
  chooseDocumentsRetryAction,
} from '@/lib/pbv/tenant-flow-handlers';

describe('attemptUnitSaveAndDecide — Gate 1 (Gap A)', () => {
  it('PATCH ok → navigate=true, no error (success path)', async () => {
    const patch = vi.fn().mockResolvedValue({ ok: true });
    const out = await attemptUnitSaveAndDecide({
      selectedUnit: 'B-204',
      initialUnit: 'B-201',
      patch,
    });
    expect(out).toEqual({ navigate: true, error: null });
    expect(patch).toHaveBeenCalledOnce();
  });

  it('PATCH !ok → navigate=false, error surfaced (failure halts nav)', async () => {
    const patch = vi.fn().mockResolvedValue({ ok: false });
    const out = await attemptUnitSaveAndDecide({
      selectedUnit: 'B-204',
      initialUnit: 'B-201',
      patch,
    });
    expect(out).toEqual({ navigate: false, error: 'unit_save_failed' });
    expect(patch).toHaveBeenCalledOnce();
  });

  it('PATCH throws → navigate=false, error surfaced (catch path)', async () => {
    const patch = vi.fn().mockRejectedValue(new Error('network'));
    const out = await attemptUnitSaveAndDecide({
      selectedUnit: 'B-204',
      initialUnit: 'B-201',
      patch,
    });
    expect(out).toEqual({ navigate: false, error: 'unit_save_failed' });
    expect(patch).toHaveBeenCalledOnce();
  });

  it('no unit change (same value) → navigate=true, PATCH not called', async () => {
    const patch = vi.fn();
    const out = await attemptUnitSaveAndDecide({
      selectedUnit: 'B-201',
      initialUnit: 'B-201',
      patch,
    });
    expect(out).toEqual({ navigate: true, error: null });
    expect(patch).not.toHaveBeenCalled();
  });

  it('selectedUnit empty (nothing chosen) → navigate=true, PATCH not called', async () => {
    const patch = vi.fn();
    const out = await attemptUnitSaveAndDecide({
      selectedUnit: '',
      initialUnit: 'B-201',
      patch,
    });
    expect(out).toEqual({ navigate: true, error: null });
    expect(patch).not.toHaveBeenCalled();
  });
});

describe('chooseDocumentsRetryAction — Gate 2 (Gap B)', () => {
  it('data-fetch error only → refetch (the new behavior)', () => {
    expect(
      chooseDocumentsRetryAction({
        hasBootstrapError: false,
        hasDataFetchError: true,
        hasPageViewError: false,
      })
    ).toBe('refetch');
  });

  it('bootstrap error → reload (preserves PRD-67 intentional reload)', () => {
    expect(
      chooseDocumentsRetryAction({
        hasBootstrapError: true,
        hasDataFetchError: false,
        hasPageViewError: false,
      })
    ).toBe('reload');
  });

  it('pageView error → reload (preserves PRD-67 intentional reload)', () => {
    expect(
      chooseDocumentsRetryAction({
        hasBootstrapError: false,
        hasDataFetchError: false,
        hasPageViewError: true,
      })
    ).toBe('reload');
  });

  it('bootstrap + data-fetch errors together → reload (bootstrap wins)', () => {
    expect(
      chooseDocumentsRetryAction({
        hasBootstrapError: true,
        hasDataFetchError: true,
        hasPageViewError: false,
      })
    ).toBe('reload');
  });

  it('pageView + data-fetch errors together → reload (pageView wins)', () => {
    expect(
      chooseDocumentsRetryAction({
        hasBootstrapError: false,
        hasDataFetchError: true,
        hasPageViewError: true,
      })
    ).toBe('reload');
  });

  it('no errors flagged → reload (defensive fallback; never invoked in practice since the error block only renders when one is true)', () => {
    expect(
      chooseDocumentsRetryAction({
        hasBootstrapError: false,
        hasDataFetchError: false,
        hasPageViewError: false,
      })
    ).toBe('reload');
  });
});
