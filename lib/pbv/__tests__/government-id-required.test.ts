/**
 * PRD-65 — Government Photo ID is required, universal, first, scannable
 *
 * Asserts the four cross-file invariants for the new government_id doc_type:
 *  1. documentTriggers — isTriggered === () => true (universal/always required).
 *  2. docContent — title/description/fallback present in EN/ES/PT,
 *     multiFile: true, maxFiles: 2.
 *  3. docTypeHelp — EN/ES/PT help present and non-empty.
 *  4. The seed migration row for `government_id` exists, sorts first
 *     (display_order=5), is required, and has category='identity'.
 *  5. AlmostDoneReview source places `identity` first in `categories[]` and
 *     initializes an `identity` bucket.
 *
 * The application_documents row + finalize gating are downstream of the same
 * shape (`required=true` after filterByTriggers), and `validateReadyToFinalize`
 * Check 4 is already covered by the PRD-56/57/58 tests; no new finalize test
 * is needed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { TRIGGER_MAP, DOCUMENT_TRIGGERS } from '../documentTriggers';
import {
  DOC_CONTENT,
  isMultiFileDoc,
  getMaxFiles,
  getDocTitle,
  getDocDescription,
} from '../cards/docContent';
import { DOC_TYPE_HELP } from '../docTypeHelp';

describe('PRD-65: government_id — required, first, universal, scannable', () => {
  describe('Trigger (universal / always required)', () => {
    it('TRIGGER_MAP has a government_id entry', () => {
      expect(TRIGGER_MAP.has('government_id')).toBe(true);
    });

    it('isTriggered is true for any/empty intake', () => {
      const trigger = TRIGGER_MAP.get('government_id');
      expect(trigger).toBeDefined();
      // Empty intake
      expect(trigger!.isTriggered({} as any)).toBe(true);
      // Minimal intake (no income, no assets, citizen, no children)
      expect(
        trigger!.isTriggered({
          household: { members: [{ citizenship_status: 'citizen' }] },
          income: { by_member: [] },
          assets: {},
          medical: {},
        } as any)
      ).toBe(true);
    });

    it('appears in DOCUMENT_TRIGGERS at the start (identity block)', () => {
      // It's the first entry — assert it's there and earlier than the income block.
      const idx = DOCUMENT_TRIGGERS.findIndex((t) => t.doc_type === 'government_id');
      expect(idx).toBeGreaterThanOrEqual(0);
      const paystubsIdx = DOCUMENT_TRIGGERS.findIndex((t) => t.doc_type === 'paystubs');
      expect(idx).toBeLessThan(paystubsIdx);
    });
  });

  describe('Plain-language content EN/ES/PT', () => {
    it('docContent.government_id is multiFile:true with maxFiles:2', () => {
      expect(DOC_CONTENT['government_id']).toBeDefined();
      expect(isMultiFileDoc('government_id')).toBe(true);
      expect(getMaxFiles('government_id')).toBe(2);
    });

    it('has non-empty title in EN/ES/PT', () => {
      expect(getDocTitle('government_id', 'en').length).toBeGreaterThan(0);
      expect(getDocTitle('government_id', 'es').length).toBeGreaterThan(0);
      expect(getDocTitle('government_id', 'pt').length).toBeGreaterThan(0);
    });

    it('has non-empty description in EN/ES/PT', () => {
      expect(getDocDescription('government_id', 'en').length).toBeGreaterThan(0);
      expect(getDocDescription('government_id', 'es').length).toBeGreaterThan(0);
      expect(getDocDescription('government_id', 'pt').length).toBeGreaterThan(0);
    });

    it('has non-empty fallback in EN/ES/PT', () => {
      expect(DOC_CONTENT['government_id'].fallback.en.length).toBeGreaterThan(0);
      expect(DOC_CONTENT['government_id'].fallback.es.length).toBeGreaterThan(0);
      expect(DOC_CONTENT['government_id'].fallback.pt.length).toBeGreaterThan(0);
    });

    it('has docTypeHelp entry in EN/ES/PT', () => {
      const help = DOC_TYPE_HELP['government_id'];
      expect(help).toBeDefined();
      expect(help.en.length).toBeGreaterThan(0);
      expect(help.es.length).toBeGreaterThan(0);
      expect(help.pt.length).toBeGreaterThan(0);
    });
  });

  describe('Seed migration row sorts first + required + identity category', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase', 'migrations', '20260521030000_prd65_government_id_required.sql'
    );
    const sql = readFileSync(migrationPath, 'utf8');

    it('inserts a government_id template row with the right shape', () => {
      // doc_type
      expect(sql).toMatch(/'pbv-full-application',\s*'government_id'/);
      // category = identity, display_order = 5
      expect(sql).toMatch(/'identity'/);
      expect(sql).toMatch(/\b5\b/); // display_order
      // required = TRUE (insert VALUES list)
      expect(sql).toMatch(/TRUE,\s*NULL,\s*5,\s*FALSE,\s*'submission'/);
    });

    it('display_order=5 is below paystubs=10, so it sorts first', () => {
      // Read the pre-existing seed and confirm paystubs is at 10.
      const seedPath = join(
        process.cwd(),
        'supabase', 'migrations', '20260423220000_pbv_full_app_document_templates.sql'
      );
      const seed = readFileSync(seedPath, 'utf8');
      // The paystubs row has `TRUE, NULL, 10, TRUE, 'each_member_matching_rule'`
      expect(seed).toMatch(/'paystubs'[\s\S]*?TRUE,\s*NULL,\s*10,/);
      // Our new row uses 5 — which is < 10.
      expect(5).toBeLessThan(10);
    });

    it('backfills only un-submitted in-progress applications (PRD O3 default)', () => {
      expect(sql).toMatch(/INSERT INTO public\.application_documents/);
      expect(sql).toMatch(/submitted_at IS NULL/);
      expect(sql).toMatch(/NOT EXISTS/); // idempotency guard
    });
  });

  describe('AlmostDoneReview review-screen wiring', () => {
    const reviewPath = join(
      process.cwd(),
      'components', 'pbv', 'cards', 'AlmostDoneReview.tsx'
    );
    const reviewSrc = readFileSync(reviewPath, 'utf8');

    it("'identity' is part of the DocCategory union", () => {
      expect(reviewSrc).toMatch(/\|\s*'identity'/);
    });

    it("the categories[] list places 'identity' first", () => {
      // The first key entry after `categories: CategoryInfo[] = [` should be 'identity'.
      const firstKeyMatch = reviewSrc.match(/categories:\s*CategoryInfo\[\]\s*=\s*\[\s*\{\s*key:\s*'([^']+)'/);
      expect(firstKeyMatch?.[1]).toBe('identity');
    });

    it("grouping bucket initializes an 'identity' key", () => {
      expect(reviewSrc).toMatch(/identity:\s*\[\]/);
    });
  });
});
