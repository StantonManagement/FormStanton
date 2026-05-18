/**
 * useCardAnalytics.ts
 *
 * F7 — Analytics events for the document card stack.
 *
 * Batches events client-side, debounces network calls,
 * and retries on failure without blocking UX.
 *
 * Events:
 * - DOCUMENT_CARD_VIEWED
 * - DOCUMENT_CARD_COMPLETED
 * - DOCUMENT_CARD_DEFERRED
 * - DOCUMENT_CARD_SKIPPED
 * - DOCUMENT_CARD_DEACTIVATED
 * - DOCUMENT_HELP_OPENED
 * - DOCUMENT_SCANNER_OPENED
 * - DOCUMENT_SCANNER_RETAKE
 * - DOCUMENT_UPLOAD_SUCCESS
 * - DOCUMENT_UPLOAD_FAILED
 * - DOCUMENT_STACK_STARTED
 * - DOCUMENT_SIDESHEET_OPENED
 */

import { useCallback, useRef, useEffect, useState } from 'react';

export type CardAnalyticsEventType =
  | 'DOCUMENT_CARD_VIEWED'
  | 'DOCUMENT_CARD_COMPLETED'
  | 'DOCUMENT_CARD_DEFERRED'
  | 'DOCUMENT_CARD_SKIPPED'
  | 'DOCUMENT_CARD_DEACTIVATED'
  | 'DOCUMENT_HELP_OPENED'
  | 'DOCUMENT_SCANNER_OPENED'
  | 'DOCUMENT_SCANNER_RETAKE'
  | 'DOCUMENT_UPLOAD_SUCCESS'
  | 'DOCUMENT_UPLOAD_FAILED'
  | 'DOCUMENT_STACK_STARTED'
  | 'DOCUMENT_SIDESHEET_OPENED';

interface AnalyticsEvent {
  type: CardAnalyticsEventType;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface UseCardAnalyticsOptions {
  /** Application token for the events endpoint */
  token: string;
  /** Application ID */
  applicationId: string;
  /** Max events per batch */
  batchSize?: number;
  /** Debounce flush interval in ms */
  flushIntervalMs?: number;
  /** Max retry attempts */
  maxRetries?: number;
}

interface UseCardAnalyticsReturn {
  /** Emit an analytics event */
  emit: (eventType: CardAnalyticsEventType, payload: Record<string, unknown>) => void;
  /** Force flush pending events */
  flush: () => Promise<void>;
  /** Pending event count */
  pendingCount: number;
  /** Whether currently flushing */
  isFlushing: boolean;
  /** Last error if any */
  lastError: string | null;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;

export function useCardAnalytics(options: UseCardAnalyticsOptions): UseCardAnalyticsReturn {
  const { token, applicationId, batchSize = DEFAULT_BATCH_SIZE, flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS, maxRetries = DEFAULT_MAX_RETRIES } = options;

  const [pendingCount, setPendingCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const eventQueueRef = useRef<AnalyticsEvent[]>([]);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  // Flush events to server
  const flush = useCallback(async (): Promise<void> => {
    if (eventQueueRef.current.length === 0 || isFlushing) {
      return;
    }

    setIsFlushing(true);
    setLastError(null);

    const eventsToSend = eventQueueRef.current.slice(0, batchSize);

    try {
      const response = await fetch(`/api/t/${token}/pbv-full-app/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          events: eventsToSend.map((e) => ({
            event_type: e.type,
            payload: e.payload,
            timestamp: e.timestamp,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove sent events from queue
      eventQueueRef.current = eventQueueRef.current.slice(eventsToSend.length);
      retryCountRef.current = 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errorMessage);

      // Retry with exponential backoff
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);

        setTimeout(() => {
          flush();
        }, delay);
      }
      // If max retries exceeded, events stay in queue for next flush attempt
    } finally {
      setIsFlushing(false);
      setPendingCount(eventQueueRef.current.length);
    }
  }, [token, applicationId, batchSize, maxRetries, isFlushing]);

  // Emit an event
  const emit = useCallback(
    (eventType: CardAnalyticsEventType, payload: Record<string, unknown>): void => {
      const event: AnalyticsEvent = {
        type: eventType,
        payload: {
          ...payload,
          application_id: applicationId,
          emitted_at: new Date().toISOString(),
        },
        timestamp: Date.now(),
      };

      eventQueueRef.current.push(event);
      setPendingCount(eventQueueRef.current.length);

      // Debounce flush
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }

      flushTimeoutRef.current = setTimeout(() => {
        flush();
      }, 100); // Small debounce to batch rapid events
    },
    [applicationId, flush]
  );

  // Periodic flush
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (eventQueueRef.current.length > 0) {
        flush();
      }
    }, flushIntervalMs);

    return () => {
      clearInterval(intervalId);
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      // Flush any remaining events on unmount
      if (eventQueueRef.current.length > 0) {
        flush();
      }
    };
  }, [flushIntervalMs, flush]);

  // Flush on page hide/visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && eventQueueRef.current.length > 0) {
        // Use sendBeacon for reliable delivery on page hide
        const events = eventQueueRef.current.slice(0, batchSize);
        const blob = new Blob(
          [
            JSON.stringify({
              application_id: applicationId,
              events: events.map((e) => ({
                event_type: e.type,
                payload: e.payload,
                timestamp: e.timestamp,
              })),
            }),
          ],
          { type: 'application/json' }
        );

        navigator.sendBeacon?.(`/api/t/${token}/pbv-full-app/events`, blob);
        eventQueueRef.current = eventQueueRef.current.slice(events.length);
        setPendingCount(eventQueueRef.current.length);
      }
    };

    const handleBeforeUnload = () => {
      // Emit skip event for current card if leaving
      emit('DOCUMENT_CARD_SKIPPED', {
        reason: 'page_hide',
        timestamp: Date.now(),
      });
      handleVisibilityChange();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [emit, token, applicationId, batchSize]);

  return {
    emit,
    flush,
    pendingCount,
    isFlushing,
    lastError,
  };
}

/**
 * Stub analytics hook for when analytics are disabled.
 */
export function useNoOpAnalytics(): UseCardAnalyticsReturn {
  return {
    emit: () => {},
    flush: async () => {},
    pendingCount: 0,
    isFlushing: false,
    lastError: null,
  };
}
