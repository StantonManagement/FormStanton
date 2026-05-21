/**
 * PRD-73 U7: pure derivation of the tenant dashboard hub-level progress
 * indicator from per-card statuses.
 *
 * Locked cards (e.g. a task not yet unlocked because a prerequisite isn't
 * met, or one that doesn't apply to the household — PRD-73 says to exclude
 * those from the denominator) drop out of both numerator and denominator;
 * 'complete' cards add to the numerator; everything else (pending,
 * in_progress) counts toward the denominator but not the numerator.
 *
 * Total may temporarily drop below 4 while a card is locked. That is
 * intentional — the bar reflects "applicable tasks" at any moment.
 */
import type { CardStatus } from '@/components/pbv/sign/DashboardCard';

export interface HubProgress {
  /** Number of applicable cards in 'complete' state. */
  completed: number;
  /** Number of applicable cards (i.e. not 'locked'). */
  total: number;
  /** Rounded percentage 0–100 for the progress bar. 0 when total === 0. */
  percentage: number;
}

export function computeHubProgress(statuses: CardStatus[]): HubProgress {
  const applicable = statuses.filter((s) => s !== 'locked');
  const completed = applicable.filter((s) => s === 'complete').length;
  const total = applicable.length;
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return { completed, total, percentage };
}
