/**
 * handoffRetry.ts
 *
 * PRD-85 — intake→signing handoff (pbv_preflight_checklist) reliability.
 *
 * Pure, event-derived logic for the handoff state machine. The intake→signing
 * handoff is the `pbv_preflight_checklist` SMS sent at intake completion. Its
 * delivery state is NOT a column — it is derived from `application_events`
 * (`notification.sent` vs `notification.failed` for this notification type),
 * keeping a single source of truth and avoiding a schema change (PRD-85 Data
 * Model: event-derived).
 *
 * Two consumers share this module:
 *   - the operator surface (pipeline dashboard) reads `isHandoffPending`
 *   - the retry cron (`/api/cron/pbv-handoff-retry`) reads `evaluateHandoffRetry`
 *
 * Both call `deriveHandoffState` first.
 */

export const PREFLIGHT_NOTIFICATION_TYPE = 'pbv_preflight_checklist';

/** Maximum total send attempts (initial intake-complete send + sweep retries). */
export const HANDOFF_MAX_ATTEMPTS = 3;

/** Retry window: attempts are bounded to this span since the first failure. */
export const HANDOFF_RETRY_WINDOW_HOURS = 24;

/**
 * Minimum hours to wait before the next retry, keyed by the number of failures
 * already recorded. After 1 failure wait 1h; after 2 failures wait 6h. This
 * spreads the (up to) 3 attempts across the 24h window with backoff.
 */
export const HANDOFF_BACKOFF_HOURS: Record<number, number> = { 1: 1, 2: 6 };

const HOUR_MS = 60 * 60 * 1000;

export interface HandoffEvent {
  /** 'notification.sent' | 'notification.failed' | ... */
  event_type: string;
  payload: { notification_type?: string } | null;
  /** ISO timestamp */
  created_at: string;
}

export interface HandoffState {
  /** A `pbv_preflight_checklist` send reached the pipeline (sent / email fallback). */
  sent: boolean;
  /** Count of failed `pbv_preflight_checklist` attempts (= attempts made). */
  failedCount: number;
  firstFailedAt: string | null;
  lastFailedAt: string | null;
}

/**
 * Reduce an application's notification events into the handoff state. Only
 * events for the preflight notification type are considered.
 */
export function deriveHandoffState(events: HandoffEvent[]): HandoffState {
  let sent = false;
  const failedAtMs: number[] = [];

  for (const ev of events) {
    if (ev.payload?.notification_type !== PREFLIGHT_NOTIFICATION_TYPE) continue;
    if (ev.event_type === 'notification.sent') {
      sent = true;
    } else if (ev.event_type === 'notification.failed') {
      failedAtMs.push(new Date(ev.created_at).getTime());
    }
  }

  failedAtMs.sort((a, b) => a - b);

  return {
    sent,
    failedCount: failedAtMs.length,
    firstFailedAt: failedAtMs.length ? new Date(failedAtMs[0]).toISOString() : null,
    lastFailedAt: failedAtMs.length ? new Date(failedAtMs[failedAtMs.length - 1]).toISOString() : null,
  };
}

/**
 * Operator-surface signal: intake handoff was attempted but never sent. This is
 * the "intake complete / handoff not sent" indicator. Distinct from retry
 * eligibility — an exhausted/aged-out handoff is still pending (operator can
 * resend manually) even though the auto-sweep will no longer touch it.
 */
export function isHandoffPending(state: HandoffState): boolean {
  return !state.sent && state.failedCount > 0;
}

export interface RetryEvalInput {
  /** Current time in ms (pass Date.now() at the call site). */
  now: number;
  state: HandoffState;
  /** ISO; used only when no failure event exists yet ("absent" handoff). */
  intakeCompletedAt: string | null;
}

export type RetryDecision =
  | { eligible: true }
  | {
      eligible: false;
      reason:
        | 'already_sent'
        | 'attempts_exhausted'
        | 'window_closed'
        | 'backoff_pending'
        | 'no_intake';
    };

/**
 * Decide whether the cron sweep should re-attempt the handoff for one app.
 *
 * Guarantees relevant to PRD-85 gating:
 *   - Apps whose first (or only) failure is older than the 24h window are NOT
 *     auto-retried — they are left to the operator. This is what keeps the
 *     Phase-4-gated backfill (Mia / Santha, failures from 5/20–5/27) out of the
 *     automatic sweep while still surfacing them on the operator dashboard.
 *   - An "absent" handoff (no failure event) is only retried within 24h of
 *     intake completion, so old/seed apps are never auto-notified.
 */
export function evaluateHandoffRetry(input: RetryEvalInput): RetryDecision {
  const { now, state, intakeCompletedAt } = input;

  if (state.sent) return { eligible: false, reason: 'already_sent' };
  if (state.failedCount >= HANDOFF_MAX_ATTEMPTS) {
    return { eligible: false, reason: 'attempts_exhausted' };
  }

  const windowMs = HANDOFF_RETRY_WINDOW_HOURS * HOUR_MS;

  // No failure recorded yet — an absent handoff. Only retry if intake completed
  // recently, so we never re-notify historical / seed applications.
  if (state.failedCount === 0) {
    if (!intakeCompletedAt) return { eligible: false, reason: 'no_intake' };
    if (now - new Date(intakeCompletedAt).getTime() > windowMs) {
      return { eligible: false, reason: 'window_closed' };
    }
    return { eligible: true };
  }

  // At least one failure. Bound to the window since the first failure.
  const firstFailedMs = new Date(state.firstFailedAt as string).getTime();
  if (now - firstFailedMs > windowMs) {
    return { eligible: false, reason: 'window_closed' };
  }

  // Respect backoff since the most recent failure.
  const backoffHours =
    HANDOFF_BACKOFF_HOURS[state.failedCount] ??
    HANDOFF_BACKOFF_HOURS[Math.max(...Object.keys(HANDOFF_BACKOFF_HOURS).map(Number))];
  const lastFailedMs = new Date(state.lastFailedAt as string).getTime();
  if (now - lastFailedMs < backoffHours * HOUR_MS) {
    return { eligible: false, reason: 'backoff_pending' };
  }

  return { eligible: true };
}
