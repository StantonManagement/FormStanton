/**
 * PRD-73 U7 — computeHubProgress unit tests.
 *
 * Gates from the PRD's verification plan:
 *  - all-complete → 4/4 (100%)
 *  - mixed → correct count
 *  - locked task excluded from denominator
 */

import { describe, it, expect } from 'vitest';
import { computeHubProgress } from '@/lib/pbv/computeHubProgress';

describe('computeHubProgress', () => {
  it('all four cards complete → 4/4 at 100%', () => {
    const out = computeHubProgress(['complete', 'complete', 'complete', 'complete']);
    expect(out).toEqual({ completed: 4, total: 4, percentage: 100 });
  });

  it('all four cards pending → 0/4 at 0%', () => {
    const out = computeHubProgress(['pending', 'pending', 'pending', 'pending']);
    expect(out).toEqual({ completed: 0, total: 4, percentage: 0 });
  });

  it('mixed (1 complete, 1 in_progress, 2 pending) → 1/4 at 25%', () => {
    const out = computeHubProgress(['complete', 'in_progress', 'pending', 'pending']);
    expect(out).toEqual({ completed: 1, total: 4, percentage: 25 });
  });

  it('a locked card is excluded from the denominator', () => {
    // Initial state pattern: summary pending, forms locked (waits on summary),
    // documents pending, signers complete (no additional signers).
    const out = computeHubProgress(['pending', 'locked', 'pending', 'complete']);
    expect(out).toEqual({ completed: 1, total: 3, percentage: 33 });
  });

  it('multiple locked cards all drop out of the denominator', () => {
    const out = computeHubProgress(['complete', 'locked', 'locked', 'complete']);
    expect(out).toEqual({ completed: 2, total: 2, percentage: 100 });
  });

  it('every card locked → 0/0 at 0% (no divide-by-zero)', () => {
    const out = computeHubProgress(['locked', 'locked', 'locked', 'locked']);
    expect(out).toEqual({ completed: 0, total: 0, percentage: 0 });
  });

  it('in_progress alone does not count as complete', () => {
    const out = computeHubProgress(['in_progress', 'in_progress', 'in_progress', 'in_progress']);
    expect(out).toEqual({ completed: 0, total: 4, percentage: 0 });
  });

  it('rounds percentage (3 of 4 → 75)', () => {
    const out = computeHubProgress(['complete', 'complete', 'complete', 'pending']);
    expect(out).toEqual({ completed: 3, total: 4, percentage: 75 });
  });

  it('rounds percentage (2 of 3 → 67)', () => {
    const out = computeHubProgress(['complete', 'complete', 'pending', 'locked']);
    expect(out).toEqual({ completed: 2, total: 3, percentage: 67 });
  });
});
