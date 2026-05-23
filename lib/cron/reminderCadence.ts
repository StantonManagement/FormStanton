/**
 * PRD-74 Phase 2 — reminder cadence anchored to the intake-completion timestamp.
 *
 * Pure helper, no I/O. Extracted from the cron route so it can be unit-tested
 * without instantiating supabase or notification mocks.
 *
 * Cadence days: 3, 7, 14, 21, 28, 35, 42. The "next" reminder is computed
 * relative to the application's intake-completion time (intake_completed_at,
 * the canonical signal) — NOT wall-clock now — so a delayed or restarted cron
 * run does not slide the schedule. The parameter retains its historical name.
 */

export const REMINDER_CADENCE_DAYS = [3, 7, 14, 21, 28, 35, 42] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function getNextReminderDate(
  currentDay: number,
  intakeSubmittedAt: string | null | undefined
): Date | null {
  const nextDay = REMINDER_CADENCE_DAYS.find(day => day > currentDay);
  if (nextDay === undefined) {
    return null;
  }

  if (!intakeSubmittedAt) {
    return null;
  }

  const base = new Date(intakeSubmittedAt);
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  return new Date(base.getTime() + nextDay * DAY_MS);
}
