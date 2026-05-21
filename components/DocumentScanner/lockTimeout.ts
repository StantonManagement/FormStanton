/**
 * PRD-60: Lock timeout tracker for low-contrast / can't-lock hint.
 *
 * A framework-free tracker that monitors how long we've been without a lock
 * and signals when to show a "try more light / darker surface" hint.
 *
 * Patterned after stabilityTracker.ts for consistency.
 */

export interface LockTimeoutTracker {
  /**
   * Update the tracker with current lock state.
   * @param isLocked - true if we have a valid quad lock (StabilityState.kind !== 'seeking')
   * @param now - current timestamp (ms), injectable for testing
   * @returns true if hint should be shown (continuous no-lock > threshold)
   */
  update(isLocked: boolean, now: number): boolean;

  /** Reset the tracker (e.g., when component unmounts) */
  reset(): void;
}

interface LockTimeoutOptions {
  /** Time in ms before showing the hint (default: 3500ms) */
  thresholdMs?: number;
}

class LockTimeoutTrackerImpl implements LockTimeoutTracker {
  private thresholdMs: number;
  private lastLockedAt: number;

  constructor(opts?: LockTimeoutOptions) {
    this.thresholdMs = opts?.thresholdMs ?? 3500;
    this.lastLockedAt = Date.now(); // Start as if we just had a lock
  }

  update(isLocked: boolean, now: number): boolean {
    if (isLocked) {
      // We have a lock - reset the timer
      this.lastLockedAt = now;
      return false;
    }

    // No lock - check if we've been without lock for threshold duration
    const timeSinceLastLock = now - this.lastLockedAt;
    return timeSinceLastLock >= this.thresholdMs;
  }

  reset(): void {
    this.lastLockedAt = Date.now();
  }
}

/**
 * Create a lock timeout tracker.
 *
 * @param opts - configuration options
 * @returns LockTimeoutTracker instance
 *
 * @example
 * const tracker = createLockTimeoutTracker({ thresholdMs: 3500 });
 *
 * // In onQuad callback:
 * const isLocked = stabilityState.kind !== 'seeking';
 * const showHint = tracker.update(isLocked, Date.now());
 */
export function createLockTimeoutTracker(opts?: LockTimeoutOptions): LockTimeoutTracker {
  return new LockTimeoutTrackerImpl(opts);
}
