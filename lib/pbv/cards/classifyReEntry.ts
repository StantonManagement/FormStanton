/**
 * lib/pbv/cards/classifyReEntry.ts
 *
 * Pure function to classify tenant re-entry state for PRD-44 F1.
 * Determines where to land a tenant when they return to /documents.
 */

import type { DocumentCardData } from '@/components/pbv/cards/DocumentCard';

export type ReEntryState =
  | { kind: 'first_visit' }
  | { kind: 'mid_flow' }
  | { kind: 'rejection_pending'; rejectedDocId: string }
  | { kind: 'all_complete_pending_submit' }
  | { kind: 'submitted' };

export interface ApplicationState {
  /** All documents for the application */
  documents: DocumentCardData[];
  /** Whether the application has been submitted (has submitted_at timestamp) */
  isSubmitted: boolean;
  /** Timestamp of last tenant visit (if available) */
  lastVisitedAt?: string | null;
}

/**
 * Classify re-entry state based on application state.
 * Priority order (first match wins):
 * 1. Any docs with status='rejected' since last session → rejection_pending
 * 2. Any uploads OR deferrals present AND application not submitted → mid_flow
 * 3. All required complete + submit not fired → all_complete_pending_submit
 * 4. Application submitted → submitted (PRD-20 territory)
 * 5. Otherwise → first_visit
 */
export function classifyReEntry(state: ApplicationState): ReEntryState {
  const { documents, isSubmitted } = state;

  // Priority 4: Application already submitted → PRD-20 territory
  if (isSubmitted) {
    return { kind: 'submitted' };
  }

  // Count various document states
  const rejectedDocs = documents.filter((d) => d.status === 'rejected');
  const uploadedOrApprovedDocs = documents.filter(
    (d) => d.status === 'submitted' || d.status === 'approved'
  );
  const deferredDocs = documents.filter((d) => d.is_deferred);
  // Count missing required docs (not deferred)
  const missingRequiredDocs = documents.filter(
    (d) => d.required && d.status === 'missing' && !d.is_deferred
  );

  // Priority 1: Any rejected docs → land on the first rejected card
  if (rejectedDocs.length > 0) {
    // Sort by rejection recency if available, otherwise use first
    const firstRejected = rejectedDocs[0];
    return { kind: 'rejection_pending', rejectedDocId: firstRejected.id };
  }

  // Priority 3: All required complete, not submitted
  // (This would mean all required are uploaded/approved/waived, none missing required)
  const allRequiredComplete =
    documents.length > 0 &&
    documents.every(
      (d) =>
        !d.required ||
        d.status === 'submitted' ||
        d.status === 'approved' ||
        d.status === 'waived'
    );

  const hasDeferrals = deferredDocs.length > 0;
  const hasUploads = uploadedOrApprovedDocs.length > 0;

  // Priority 2: Has uploads and missing required → mid_flow
  // (Need to continue the flow to finish missing docs)
  if (hasUploads && missingRequiredDocs.length > 0) {
    return { kind: 'mid_flow' };
  }

  // Priority 2b: Has deferrals → mid_flow (has progress, needs to continue)
  if (hasDeferrals) {
    return { kind: 'mid_flow' };
  }

  // Priority 3: All required complete (no missing required)
  if (allRequiredComplete && documents.length > 0) {
    return { kind: 'all_complete_pending_submit' };
  }

  // Priority 5: True first visit (no uploads, no deferrals, still missing required)
  return { kind: 'first_visit' };
}

/**
 * Find the index of the next missing document in the queue.
 * Used for mid_flow re-entry to land on the right card.
 */
export function findNextMissingCardIndex(documents: DocumentCardData[]): number {
  // Sort documents in the same order as the queue (rejected first, then missing, then deferred)
  const sorted = [...documents].sort((a, b) => {
    // Rejected docs come first
    if (a.status === 'rejected' && b.status !== 'rejected') return -1;
    if (b.status === 'rejected' && a.status !== 'rejected') return 1;

    // Then missing (not deferred)
    if (!a.is_deferred && a.status === 'missing' && (b.is_deferred || b.status !== 'missing'))
      return -1;
    if (!b.is_deferred && b.status === 'missing' && (a.is_deferred || a.status !== 'missing'))
      return 1;

    // Then deferred
    if (a.is_deferred && !b.is_deferred) return 1;
    if (b.is_deferred && !a.is_deferred) return -1;

    // Then by display_order if available
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  // Find first missing or rejected document
  const index = sorted.findIndex((d) => d.status === 'missing' || d.status === 'rejected');

  // If no missing/rejected, return 0 (start from beginning, likely all done)
  return index === -1 ? 0 : index;
}

/**
 * Find the index of a specific document in the queue.
 * Used for rejection_pending re-entry to land on the rejected card.
 */
export function findCardIndexById(
  documents: DocumentCardData[],
  targetId: string
): number {
  // Sort documents in the same order as the queue
  const sorted = [...documents].sort((a, b) => {
    if (a.status === 'rejected' && b.status !== 'rejected') return -1;
    if (b.status === 'rejected' && a.status !== 'rejected') return 1;
    if (!a.is_deferred && a.status === 'missing' && (b.is_deferred || b.status !== 'missing'))
      return -1;
    if (!b.is_deferred && b.status === 'missing' && (a.is_deferred || a.status !== 'missing'))
      return 1;
    if (a.is_deferred && !b.is_deferred) return 1;
    if (b.is_deferred && !a.is_deferred) return -1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

  const index = sorted.findIndex((d) => d.id === targetId);
  return index === -1 ? 0 : index;
}
