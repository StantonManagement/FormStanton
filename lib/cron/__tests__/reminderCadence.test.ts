/**
 * PRD-74 Phase 2 — cadence anchoring.
 *
 * getNextReminderDate must compute the next reminder as
 *   intake_submitted_at + nextCadenceDay days
 * and be independent of wall-clock `Date.now()` so a delayed/restarted cron
 * cannot shift the 3/7/14/21/28/35/42-day schedule.
 */

import { describe, it, expect } from 'vitest';
import { getNextReminderDate } from '../reminderCadence';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('getNextReminderDate (PRD-74 Phase 2)', () => {
  const intake = '2026-01-01T12:00:00.000Z';
  const intakeMs = new Date(intake).getTime();

  it('returns intake + 3 days when no reminders have been sent yet', () => {
    const next = getNextReminderDate(0, intake);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBe(intakeMs + 3 * DAY_MS);
  });

  it('returns intake + 7 days after the day-3 reminder', () => {
    const next = getNextReminderDate(3, intake);
    expect(next!.getTime()).toBe(intakeMs + 7 * DAY_MS);
  });

  it('returns intake + 42 days as the last cadence step', () => {
    const next = getNextReminderDate(35, intake);
    expect(next!.getTime()).toBe(intakeMs + 42 * DAY_MS);
  });

  it('returns null after the final cadence day (no more reminders)', () => {
    expect(getNextReminderDate(42, intake)).toBeNull();
    expect(getNextReminderDate(100, intake)).toBeNull();
  });

  it('returns null when intake_submitted_at is null/undefined (defensive)', () => {
    expect(getNextReminderDate(0, null)).toBeNull();
    expect(getNextReminderDate(0, undefined)).toBeNull();
  });

  it('returns null when intake_submitted_at is not a valid date string', () => {
    expect(getNextReminderDate(0, 'not-a-date')).toBeNull();
  });

  it('result is independent of wall-clock now (anchor invariant)', () => {
    const a = getNextReminderDate(7, intake);
    const b = getNextReminderDate(7, intake);
    expect(a!.getTime()).toBe(b!.getTime());
    expect(a!.getTime()).toBe(intakeMs + 14 * DAY_MS);
  });
});
