import { describe, it, expect } from 'vitest';
import {
  deriveHandoffState,
  isHandoffPending,
  evaluateHandoffRetry,
  HANDOFF_MAX_ATTEMPTS,
  PREFLIGHT_NOTIFICATION_TYPE,
  type HandoffEvent,
  type HandoffState,
} from '@/lib/notifications/handoffRetry';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-05-31T12:00:00Z');

function failedEvent(at: string): HandoffEvent {
  return {
    event_type: 'notification.failed',
    payload: { notification_type: PREFLIGHT_NOTIFICATION_TYPE },
    created_at: at,
  };
}

function sentEvent(at: string): HandoffEvent {
  return {
    event_type: 'notification.sent',
    payload: { notification_type: PREFLIGHT_NOTIFICATION_TYPE },
    created_at: at,
  };
}

describe('deriveHandoffState', () => {
  it('a failed preflight send records pending state (event-derived)', () => {
    const state = deriveHandoffState([failedEvent('2026-05-31T11:00:00Z')]);
    expect(state.sent).toBe(false);
    expect(state.failedCount).toBe(1);
    expect(state.firstFailedAt).toBe('2026-05-31T11:00:00.000Z');
    expect(state.lastFailedAt).toBe('2026-05-31T11:00:00.000Z');
    expect(isHandoffPending(state)).toBe(true);
  });

  it('a sent preflight send clears pending state', () => {
    const state = deriveHandoffState([
      failedEvent('2026-05-31T10:00:00Z'),
      sentEvent('2026-05-31T11:00:00Z'),
    ]);
    expect(state.sent).toBe(true);
    expect(isHandoffPending(state)).toBe(false);
  });

  it('ignores notification events for other types', () => {
    const state = deriveHandoffState([
      {
        event_type: 'notification.failed',
        payload: { notification_type: 'docs_upload_reminder' },
        created_at: '2026-05-31T11:00:00Z',
      },
      {
        event_type: 'notification.sent',
        payload: { notification_type: 'magic_link_initial' },
        created_at: '2026-05-31T11:30:00Z',
      },
    ]);
    expect(state.sent).toBe(false);
    expect(state.failedCount).toBe(0);
    expect(isHandoffPending(state)).toBe(false);
  });

  it('orders multiple failures into first/last', () => {
    const state = deriveHandoffState([
      failedEvent('2026-05-31T11:00:00Z'),
      failedEvent('2026-05-31T09:00:00Z'),
      failedEvent('2026-05-31T10:00:00Z'),
    ]);
    expect(state.failedCount).toBe(3);
    expect(state.firstFailedAt).toBe('2026-05-31T09:00:00.000Z');
    expect(state.lastFailedAt).toBe('2026-05-31T11:00:00.000Z');
  });
});

describe('evaluateHandoffRetry — only eligible apps, attempt cap respected', () => {
  function state(partial: Partial<HandoffState>): HandoffState {
    return { sent: false, failedCount: 0, firstFailedAt: null, lastFailedAt: null, ...partial };
  }

  it('skips an already-sent handoff', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({ sent: true }),
      intakeCompletedAt: new Date(NOW - HOUR).toISOString(),
    });
    expect(decision).toEqual({ eligible: false, reason: 'already_sent' });
  });

  it('respects the attempt cap (no retry once max attempts reached)', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({
        failedCount: HANDOFF_MAX_ATTEMPTS,
        firstFailedAt: new Date(NOW - 2 * HOUR).toISOString(),
        lastFailedAt: new Date(NOW - HOUR).toISOString(),
      }),
      intakeCompletedAt: new Date(NOW - 3 * HOUR).toISOString(),
    });
    expect(decision).toEqual({ eligible: false, reason: 'attempts_exhausted' });
  });

  it('retries an absent handoff within the window of intake completion', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({ failedCount: 0 }),
      intakeCompletedAt: new Date(NOW - 2 * HOUR).toISOString(),
    });
    expect(decision.eligible).toBe(true);
  });

  it('does not retry an absent handoff outside the 24h window (left to operator)', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({ failedCount: 0 }),
      intakeCompletedAt: new Date(NOW - 30 * HOUR).toISOString(),
    });
    expect(decision).toEqual({ eligible: false, reason: 'window_closed' });
  });

  it('does not retry an absent handoff with no intake-complete timestamp', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({ failedCount: 0 }),
      intakeCompletedAt: null,
    });
    expect(decision).toEqual({ eligible: false, reason: 'no_intake' });
  });

  it('retries after one failure once the 1h backoff has elapsed', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({
        failedCount: 1,
        firstFailedAt: new Date(NOW - 2 * HOUR).toISOString(),
        lastFailedAt: new Date(NOW - 2 * HOUR).toISOString(),
      }),
      intakeCompletedAt: new Date(NOW - 2 * HOUR).toISOString(),
    });
    expect(decision.eligible).toBe(true);
  });

  it('holds off when the backoff since the last failure has not elapsed', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({
        failedCount: 1,
        firstFailedAt: new Date(NOW - 0.5 * HOUR).toISOString(),
        lastFailedAt: new Date(NOW - 0.5 * HOUR).toISOString(),
      }),
      intakeCompletedAt: new Date(NOW - 0.5 * HOUR).toISOString(),
    });
    expect(decision).toEqual({ eligible: false, reason: 'backoff_pending' });
  });

  it('does not retry once the failure is older than the 24h window (Mia/Santha case)', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({
        failedCount: 1,
        firstFailedAt: new Date(NOW - 30 * HOUR).toISOString(),
        lastFailedAt: new Date(NOW - 30 * HOUR).toISOString(),
      }),
      intakeCompletedAt: new Date(NOW - 30 * HOUR).toISOString(),
    });
    expect(decision).toEqual({ eligible: false, reason: 'window_closed' });
  });

  it('retries after two failures once the longer 6h backoff has elapsed', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({
        failedCount: 2,
        firstFailedAt: new Date(NOW - 8 * HOUR).toISOString(),
        lastFailedAt: new Date(NOW - 7 * HOUR).toISOString(),
      }),
      intakeCompletedAt: new Date(NOW - 9 * HOUR).toISOString(),
    });
    expect(decision.eligible).toBe(true);
  });

  it('holds off after two failures when only the short backoff has elapsed', () => {
    const decision = evaluateHandoffRetry({
      now: NOW,
      state: state({
        failedCount: 2,
        firstFailedAt: new Date(NOW - 4 * HOUR).toISOString(),
        lastFailedAt: new Date(NOW - 2 * HOUR).toISOString(),
      }),
      intakeCompletedAt: new Date(NOW - 5 * HOUR).toISOString(),
    });
    expect(decision).toEqual({ eligible: false, reason: 'backoff_pending' });
  });
});
