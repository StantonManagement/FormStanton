import { describe, it, expect } from 'vitest';
import { isSectionComplete, IntakeData } from '../intake-schema';

/**
 * PRD-57 Phase 1: Protected-status safety regression tests.
 *
 * These tests lock the behavior that DV/criminal history sections
 * must NOT allow Next until all protected-status questions are
 * explicitly answered (no null/undefined defaults).
 */

describe('isSectionComplete() — protected-status safety (PRD-57)', () => {
  describe('dv_homeless_ra section', () => {
    it('returns FALSE when dv_status is null (neutral default)', () => {
      const intakeData: IntakeData = {
        dv_homeless_ra: {
          dv_status: null as any,
          homeless_at_admission: false,
          reasonable_accommodation_requested: false,
        },
      };
      expect(isSectionComplete('dv_homeless_ra', intakeData)).toBe(false);
    });

    it('returns FALSE when homeless_at_admission is null', () => {
      const intakeData: IntakeData = {
        dv_homeless_ra: {
          dv_status: false,
          homeless_at_admission: null as any,
          reasonable_accommodation_requested: false,
        },
      };
      expect(isSectionComplete('dv_homeless_ra', intakeData)).toBe(false);
    });

    it('returns FALSE when reasonable_accommodation_requested is null', () => {
      const intakeData: IntakeData = {
        dv_homeless_ra: {
          dv_status: false,
          homeless_at_admission: false,
          reasonable_accommodation_requested: null as any,
        },
      };
      expect(isSectionComplete('dv_homeless_ra', intakeData)).toBe(false);
    });

    it('returns FALSE when all three are null (initial state)', () => {
      const intakeData: IntakeData = {
        dv_homeless_ra: {
          dv_status: null as any,
          homeless_at_admission: null as any,
          reasonable_accommodation_requested: null as any,
        },
      };
      expect(isSectionComplete('dv_homeless_ra', intakeData)).toBe(false);
    });

    it('returns TRUE only when all three are explicit booleans (even if false)', () => {
      const intakeData: IntakeData = {
        dv_homeless_ra: {
          dv_status: false,
          homeless_at_admission: false,
          reasonable_accommodation_requested: false,
        },
      };
      expect(isSectionComplete('dv_homeless_ra', intakeData)).toBe(true);
    });

    it('returns TRUE when all three are explicit booleans (mixed true/false)', () => {
      const intakeData: IntakeData = {
        dv_homeless_ra: {
          dv_status: true,
          homeless_at_admission: false,
          reasonable_accommodation_requested: true,
        },
      };
      expect(isSectionComplete('dv_homeless_ra', intakeData)).toBe(true);
    });
  });

  describe('criminal_history section', () => {
    it('returns FALSE when has_criminal_history is null (neutral default)', () => {
      const intakeData: IntakeData = {
        criminal_history: {
          by_member: [
            { member_slot: 1, member_name: 'Alice', has_criminal_history: null as any },
          ],
        },
      };
      expect(isSectionComplete('criminal_history', intakeData)).toBe(false);
    });

    it('returns FALSE when any member has_criminal_history is undefined', () => {
      const intakeData: IntakeData = {
        criminal_history: {
          by_member: [
            { member_slot: 1, member_name: 'Alice', has_criminal_history: false },
            { member_slot: 2, member_name: 'Bob', has_criminal_history: undefined as any },
          ],
        },
      };
      expect(isSectionComplete('criminal_history', intakeData)).toBe(false);
    });

    it('returns TRUE when all members have explicit boolean values (all false)', () => {
      const intakeData: IntakeData = {
        criminal_history: {
          by_member: [
            { member_slot: 1, member_name: 'Alice', has_criminal_history: false },
            { member_slot: 2, member_name: 'Bob', has_criminal_history: false },
          ],
        },
      };
      expect(isSectionComplete('criminal_history', intakeData)).toBe(true);
    });

    it('returns TRUE when all members have explicit boolean values (mixed)', () => {
      const intakeData: IntakeData = {
        criminal_history: {
          by_member: [
            { member_slot: 1, member_name: 'Alice', has_criminal_history: false },
            { member_slot: 2, member_name: 'Bob', has_criminal_history: true },
          ],
        },
      };
      expect(isSectionComplete('criminal_history', intakeData)).toBe(true);
    });

    it('returns FALSE when by_member array is empty', () => {
      const intakeData: IntakeData = {
        criminal_history: { by_member: [] },
      };
      expect(isSectionComplete('criminal_history', intakeData)).toBe(false);
    });

    it('returns FALSE when criminal_history is undefined', () => {
      const intakeData: IntakeData = {};
      expect(isSectionComplete('criminal_history', intakeData)).toBe(false);
    });
  });
});
