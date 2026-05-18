/**
 * lib/pbv/cards/__tests__/classifyReEntry.test.ts
 *
 * Unit tests for PRD-44 re-entry classification logic.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyReEntry,
  findNextMissingCardIndex,
  findCardIndexById,
  type ApplicationState,
} from '../classifyReEntry';
import type { DocumentCardData } from '@/components/pbv/cards/DocumentCard';

function makeDoc(
  id: string,
  status: DocumentCardData['status'],
  options: Partial<DocumentCardData> = {}
): DocumentCardData {
  return {
    id,
    doc_type: 'paystub',
    label: 'Paystub',
    required: true,
    person_slot: 1,
    status,
    rejection_reason: null,
    rejection_reason_display: null,
    current_revision: 1,
    file_url: status === 'submitted' || status === 'approved' ? '/test.pdf' : null,
    ...options,
  };
}

describe('classifyReEntry', () => {
  describe('first_visit', () => {
    it('returns first_visit when no uploads, no deferrals, not submitted', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'missing'),
          makeDoc('2', 'missing'),
          makeDoc('3', 'missing'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'first_visit' });
    });

    it('returns first_visit for empty documents array', () => {
      const state: ApplicationState = {
        documents: [],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'first_visit' });
    });
  });

  describe('submitted', () => {
    it('returns submitted when application is submitted', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'missing'),
        ],
        isSubmitted: true,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'submitted' });
    });

    it('returns submitted even with missing docs if application submitted', () => {
      const state: ApplicationState = {
        documents: [makeDoc('1', 'missing')],
        isSubmitted: true,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'submitted' });
    });
  });

  describe('rejection_pending', () => {
    it('returns rejection_pending with first rejected doc id', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'rejected', { rejection_reason_display: 'Blurry image' }),
          makeDoc('3', 'missing'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({
        kind: 'rejection_pending',
        rejectedDocId: '2',
      });
    });

    it('prioritizes rejection over mid_flow', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'rejected'),
          makeDoc('3', 'missing', { is_deferred: true }),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state).kind).toBe('rejection_pending');
    });
  });

  describe('mid_flow', () => {
    it('returns mid_flow when has uploads', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'missing'),
          makeDoc('3', 'missing'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'mid_flow' });
    });

    it('returns mid_flow when has deferrals', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'missing', { is_deferred: true }),
          makeDoc('2', 'missing'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'mid_flow' });
    });

    it('returns mid_flow when has both uploads and deferrals', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'missing', { is_deferred: true }),
          makeDoc('3', 'missing'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'mid_flow' });
    });

    it('returns mid_flow with approved docs (not just submitted)', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'approved'),
          makeDoc('2', 'missing'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'mid_flow' });
    });
  });

  describe('all_complete_pending_submit', () => {
    it('returns all_complete_pending_submit when all required complete', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'submitted'),
          makeDoc('3', 'approved'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'all_complete_pending_submit' });
    });

    it('returns all_complete_pending_submit when all required uploaded (optional missing)', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted', { required: true }),
          makeDoc('2', 'submitted', { required: true }),
          makeDoc('3', 'missing', { required: false }), // optional
        ],
        isSubmitted: false,
      };

      // All required complete (no missing required), go to review
      expect(classifyReEntry(state)).toEqual({ kind: 'all_complete_pending_submit' });
    });

    it('returns mid_flow when required doc is missing', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted', { required: true }),
          makeDoc('2', 'missing', { required: true }),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state)).toEqual({ kind: 'mid_flow' });
    });

    it('returns mid_flow when required doc is deferred', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted', { required: true }),
          makeDoc('2', 'missing', { required: true, is_deferred: true }),
        ],
        isSubmitted: false,
      };

      // Has uploads so it's mid_flow (rejection check happens before this)
      expect(classifyReEntry(state)).toEqual({ kind: 'mid_flow' });
    });

    it('returns all_complete_pending_submit when all required complete (submitted + waived)', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted', { required: true }),
          makeDoc('2', 'waived', { required: true }),
        ],
        isSubmitted: false,
      };

      // All required complete (no missing required), go to review
      expect(classifyReEntry(state)).toEqual({ kind: 'all_complete_pending_submit' });
    });

    it('returns all_complete_pending_submit when all required are waived (no uploads)', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'waived', { required: true }),
          makeDoc('2', 'waived', { required: true }),
        ],
        isSubmitted: false,
      };

      // No uploads, no deferrals, all complete via waived
      expect(classifyReEntry(state)).toEqual({ kind: 'all_complete_pending_submit' });
    });
  });

  describe('priority order', () => {
    it('submitted beats all other states', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'rejected'),
          makeDoc('2', 'submitted'),
        ],
        isSubmitted: true,
      };

      expect(classifyReEntry(state).kind).toBe('submitted');
    });

    it('rejection_pending beats mid_flow', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'rejected'),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state).kind).toBe('rejection_pending');
    });

    it('mid_flow beats all_complete_pending_submit when has uploads', () => {
      const state: ApplicationState = {
        documents: [
          makeDoc('1', 'submitted'),
          makeDoc('2', 'submitted'),
          makeDoc('3', 'missing', { is_deferred: true }),
        ],
        isSubmitted: false,
      };

      expect(classifyReEntry(state).kind).toBe('mid_flow');
    });
  });
});

describe('findNextMissingCardIndex', () => {
  it('returns 0 when all docs are missing', () => {
    const docs = [makeDoc('1', 'missing'), makeDoc('2', 'missing')];
    expect(findNextMissingCardIndex(docs)).toBe(0);
  });

  it('returns 0 when missing prioritized before submitted in sort', () => {
    const docs = [
      makeDoc('1', 'submitted'),
      makeDoc('2', 'missing'),
      makeDoc('3', 'missing'),
    ];
    // After sorting, missing docs come before submitted
    // So first missing is at index 0
    expect(findNextMissingCardIndex(docs)).toBe(0);
  });

  it('returns 0 when rejected doc present (sorted to front)', () => {
    const docs = [
      makeDoc('1', 'submitted'),
      makeDoc('2', 'rejected'),
      makeDoc('3', 'missing'),
    ];
    // After sorting: rejected first, then missing, then submitted
    expect(findNextMissingCardIndex(docs)).toBe(0);
  });

  it('prioritizes rejected over missing after sorting', () => {
    const docs = [
      makeDoc('1', 'missing'),
      makeDoc('2', 'rejected'),
      makeDoc('3', 'missing'),
    ];
    // Sorted: rejected first, so index 0 is the rejected doc
    expect(findNextMissingCardIndex(docs)).toBe(0);
  });
});

describe('findCardIndexById', () => {
  it('finds the correct index for a doc', () => {
    const docs = [
      makeDoc('1', 'missing', { display_order: 1 }),
      makeDoc('2', 'missing', { display_order: 2 }),
      makeDoc('3', 'missing', { display_order: 3 }),
    ];
    expect(findCardIndexById(docs, '2')).toBe(1);
  });

  it('returns 0 for non-existent id', () => {
    const docs = [makeDoc('1', 'missing')];
    expect(findCardIndexById(docs, 'nonexistent')).toBe(0);
  });

  it('respects sorting order with rejected first', () => {
    const docs = [
      makeDoc('1', 'missing', { display_order: 1 }),
      makeDoc('2', 'rejected', { display_order: 2 }),
      makeDoc('3', 'missing', { display_order: 3 }),
    ];
    // After sorting: '2' (rejected) is at index 0
    expect(findCardIndexById(docs, '2')).toBe(0);
    expect(findCardIndexById(docs, '1')).toBe(1);
  });
});
