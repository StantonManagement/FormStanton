/**
 * init.ts
 *
 * Registers the notification trigger subscriber with the application-events bus.
 * Import this module once in any route handler that writes application events
 * AND needs notification triggers to fire (e.g. the cron endpoint, the
 * application creation route).
 *
 * Designed to be called multiple times safely — the subscriber is only
 * registered once due to the module singleton pattern in Node.js.
 *
 * CIRCULAR DEPENDENCY NOTE:
 * application-events → (subscriber) → triggers → send → application-events
 * This is intentional and safe: the subscriber is only invoked after the
 * application-events module is fully initialized. Node.js handles this via
 * the module cache — by the time the subscriber runs, all modules are loaded.
 */

import { subscribeToApplicationEvents } from '@/lib/events/application-events';
import { dispatchNotificationTrigger } from './triggers';

let _registered = false;

export function initNotificationTriggers(): void {
  if (_registered) return;
  _registered = true;
  subscribeToApplicationEvents((eventType, applicationId, eventId) => {
    dispatchNotificationTrigger(eventType, applicationId, eventId);
  });
}
