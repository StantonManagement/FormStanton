import { describe, it, expect } from 'vitest';
import { createLockTimeoutTracker } from '../lockTimeout';

/**
 * PRD-60 Gate S1: Lock timeout tracker unit tests.
 *
 * Cover:
 * - returns false while locked
 * - returns false before thresholdMs of no-lock
 * - returns true once thresholdMs continuous no-lock elapses
 * - returns false immediately after a re-lock
 * - boundary at exactly thresholdMs
 */

describe('createLockTimeoutTracker', () => {
  const THRESHOLD = 3500;

  it('returns false while locked', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // While locked, never show hint
    expect(tracker.update(true, startTime)).toBe(false);
    expect(tracker.update(true, startTime + 1000)).toBe(false);
    expect(tracker.update(true, startTime + 5000)).toBe(false);
    expect(tracker.update(true, startTime + 10000)).toBe(false);
  });

  it('returns false before thresholdMs of no-lock', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // Start locked
    expect(tracker.update(true, startTime)).toBe(false);

    // Lose lock, but before threshold
    expect(tracker.update(false, startTime + 1000)).toBe(false);
    expect(tracker.update(false, startTime + 2000)).toBe(false);
    expect(tracker.update(false, startTime + 3499)).toBe(false);
  });

  it('returns true once thresholdMs continuous no-lock elapses', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // Start locked
    expect(tracker.update(true, startTime)).toBe(false);

    // Lose lock
    expect(tracker.update(false, startTime + THRESHOLD)).toBe(true);
    expect(tracker.update(false, startTime + THRESHOLD + 1000)).toBe(true);
  });

  it('returns false immediately after a re-lock', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // Start locked
    expect(tracker.update(true, startTime)).toBe(false);

    // Lose lock past threshold
    expect(tracker.update(false, startTime + THRESHOLD)).toBe(true);

    // Re-lock - hint should immediately disappear
    expect(tracker.update(true, startTime + THRESHOLD + 100)).toBe(false);

    // Stay locked
    expect(tracker.update(true, startTime + THRESHOLD + 5000)).toBe(false);
  });

  it('boundary at exactly thresholdMs', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // Start locked
    expect(tracker.update(true, startTime)).toBe(false);

    // At exactly threshold - should show hint (>= threshold)
    expect(tracker.update(false, startTime + THRESHOLD)).toBe(true);
  });

  it('resets timer on reset()', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // Start locked, then lose lock
    expect(tracker.update(true, startTime)).toBe(false);
    expect(tracker.update(false, startTime + THRESHOLD)).toBe(true);

    // Reset - timer starts fresh
    tracker.reset();

    // After reset, we're back to "just locked" state
    // Note: reset() sets lastLockedAt to Date.now(), so we need to
    // update with current time to see the effect
    const afterReset = Date.now();
    expect(tracker.update(false, afterReset)).toBe(false);
    expect(tracker.update(false, afterReset + THRESHOLD - 1)).toBe(false);
    expect(tracker.update(false, afterReset + THRESHOLD)).toBe(true);
  });

  it('uses default threshold of 3500ms when not specified', () => {
    const tracker = createLockTimeoutTracker();
    const startTime = 10000;

    // Start locked
    expect(tracker.update(true, startTime)).toBe(false);

    // Should use default 3500ms
    expect(tracker.update(false, startTime + 3499)).toBe(false);
    expect(tracker.update(false, startTime + 3500)).toBe(true);
  });

  it('handles rapid lock/unlock transitions', () => {
    const tracker = createLockTimeoutTracker({ thresholdMs: THRESHOLD });
    const startTime = 10000;

    // Start locked
    expect(tracker.update(true, startTime)).toBe(false);

    // Rapid transitions
    expect(tracker.update(false, startTime + 1000)).toBe(false); // unlock
    expect(tracker.update(true, startTime + 1500)).toBe(false); // re-lock
    expect(tracker.update(false, startTime + 2000)).toBe(false); // unlock
    expect(tracker.update(true, startTime + 2500)).toBe(false); // re-lock
    expect(tracker.update(false, startTime + 3000)).toBe(false); // unlock

    // Still not at threshold because of resets
    expect(tracker.update(false, startTime + 5000)).toBe(false); // ~2000ms since last lock
    expect(tracker.update(false, startTime + 5500)).toBe(false); // ~2500ms since last lock
    expect(tracker.update(false, startTime + 6000)).toBe(true); // ~3500ms since last lock (at 2500 + 3500 = 6000)
  });
});
