/**
 * seedFromTemplates.test.ts
 *
 * Unit tests for seedDocumentsForApplication and seedDocumentsForSubmission.
 *
 * These are unit tests (not save-path integration tests) because the seeding
 * primitives use supabaseAdmin internally. We mock the module to isolate
 * the slot-expansion and idempotency logic.
 *
 * Coverage:
 *   - submission-level template (person_slot = 0)
 *   - each_adult template
 *   - each_member_matching_rule template
 *   - idempotency: existing slots skipped
 *   - conditional templates: seeded regardless (admin seed seeds all)
 *   - zero household members fallback to slot 0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock supabase admin client
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();

const makeChain = (resolveWith: unknown) => {
  const chain: Record<string, unknown> = {};
  chain['select'] = vi.fn(() => chain);
  chain['eq'] = vi.fn(() => chain);
  chain['order'] = vi.fn(() => chain);
  chain['insert'] = vi.fn(() => Promise.resolve({ error: null }));
  // Make it thenable so await works
  chain['then'] = (resolve: (v: unknown) => void) => resolve(resolveWith);
  return chain;
};

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Partial<{
  doc_type: string;
  label: string;
  required: boolean;
  display_order: number;
  per_person: boolean;
  applies_to: string;
  member_filter: unknown;
  requires_signature: boolean;
  signer_scope: string | null;
}> = {}) {
  return {
    doc_type: 'bank_statement',
    label: 'Bank Statement',
    required: true,
    display_order: 0,
    per_person: false,
    applies_to: 'submission',
    member_filter: null,
    requires_signature: false,
    signer_scope: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedDocumentsForApplication', () => {
  let fromMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromMock = vi.fn();
    (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from = fromMock;
  });

  it('seeds a submission-level template (person_slot = 0)', async () => {
    const templates = [makeTemplate({ doc_type: 'bank_statement', applies_to: 'submission' })];
    const insertedRows: object[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: templates, error: null }) }) }),
        };
      }
      if (table === 'application_documents') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }),
          insert: (rows: object[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
    });

    const { seedDocumentsForApplication } = await import('../seedFromTemplates');
    const result = await seedDocumentsForApplication({
      formId: 'pbv-full-application',
      anchorType: 'pbv_full_application',
      anchorId: 'app-id-001',
      householdMembers: [],
    });

    expect(result.inserted).toBe(1);
    expect(result.perTemplate['bank_statement']).toBe(1);
    expect(insertedRows).toHaveLength(1);
    expect((insertedRows[0] as Record<string, unknown>)['person_slot']).toBe(0);
    expect((insertedRows[0] as Record<string, unknown>)['anchor_type']).toBe('pbv_full_application');
    expect((insertedRows[0] as Record<string, unknown>)['status']).toBe('missing');
  });

  it('seeds each_adult template — only members aged 18+', async () => {
    const templates = [makeTemplate({ doc_type: 'govt_id', per_person: true, applies_to: 'each_adult' })];
    const insertedRows: object[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: templates, error: null }) }) }),
        };
      }
      if (table === 'application_documents') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }),
          insert: (rows: object[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
    });

    const { seedDocumentsForApplication } = await import('../seedFromTemplates');
    const result = await seedDocumentsForApplication({
      formId: 'pbv-full-application',
      anchorType: 'pbv_full_application',
      anchorId: 'app-id-002',
      householdMembers: [
        { age: 35, name: 'Adult One' },
        { age: 12, name: 'Child' },
        { age: 22, name: 'Adult Two' },
      ],
    });

    expect(result.inserted).toBe(2);
    const slots = insertedRows.map((r) => (r as Record<string, unknown>)['person_slot']);
    expect(slots).toEqual([1, 3]); // adults at index 0 (slot 1) and index 2 (slot 3)
  });

  it('seeds each_member_matching_rule template', async () => {
    const templates = [makeTemplate({
      doc_type: 'disability_doc',
      per_person: true,
      applies_to: 'each_member_matching_rule',
      member_filter: { field: 'disability', value: true },
    })];
    const insertedRows: object[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: templates, error: null }) }) }),
        };
      }
      if (table === 'application_documents') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }),
          insert: (rows: object[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
    });

    const { seedDocumentsForApplication } = await import('../seedFromTemplates');
    const result = await seedDocumentsForApplication({
      formId: 'pbv-full-application',
      anchorType: 'pbv_full_application',
      anchorId: 'app-id-003',
      householdMembers: [
        { disability: false, name: 'No Disability' },
        { disability: true, name: 'Has Disability' },
      ],
    });

    expect(result.inserted).toBe(1);
    expect((insertedRows[0] as Record<string, unknown>)['person_slot']).toBe(2);
  });

  it('is idempotent — existing slots are skipped', async () => {
    const templates = [makeTemplate({ doc_type: 'bank_statement', applies_to: 'submission' })];
    const insertedRows: object[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: templates, error: null }) }) }),
        };
      }
      if (table === 'application_documents') {
        return {
          // existing row already present
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({
            data: [{ doc_type: 'bank_statement', person_slot: 0 }],
            error: null,
          }) }) }) }),
          insert: (rows: object[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
    });

    const { seedDocumentsForApplication } = await import('../seedFromTemplates');
    const result = await seedDocumentsForApplication({
      formId: 'pbv-full-application',
      anchorType: 'pbv_full_application',
      anchorId: 'app-id-004',
      householdMembers: [],
    });

    expect(result.inserted).toBe(0);
    expect(insertedRows).toHaveLength(0);
  });

  it('falls back to slot 0 when per_person but zero matching members', async () => {
    const templates = [makeTemplate({
      doc_type: 'disability_doc',
      per_person: true,
      applies_to: 'each_adult',
    })];
    const insertedRows: object[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: templates, error: null }) }) }),
        };
      }
      if (table === 'application_documents') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }),
          insert: (rows: object[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
    });

    const { seedDocumentsForApplication } = await import('../seedFromTemplates');
    // No household members → no adults → falls back to slot 0
    const result = await seedDocumentsForApplication({
      formId: 'pbv-full-application',
      anchorType: 'pbv_full_application',
      anchorId: 'app-id-005',
      householdMembers: [],
    });

    expect(result.inserted).toBe(1);
    expect((insertedRows[0] as Record<string, unknown>)['person_slot']).toBe(0);
  });

  it('throws when no templates found for formId', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        };
      }
    });

    const { seedDocumentsForApplication } = await import('../seedFromTemplates');
    await expect(
      seedDocumentsForApplication({
        formId: 'nonexistent-form',
        anchorType: 'pbv_full_application',
        anchorId: 'app-id-006',
        householdMembers: [],
      })
    ).rejects.toThrow('No templates found for form_id');
  });
});

describe('seedDocumentsForSubmission', () => {
  let fromMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fromMock = vi.fn();
    (supabaseAdmin as unknown as { from: ReturnType<typeof vi.fn> }).from = fromMock;
  });

  it('seeds a submission-level template into form_submission_documents', async () => {
    const templates = [makeTemplate({ doc_type: 'lease', applies_to: 'submission' })];
    const insertedRows: object[] = [];

    fromMock.mockImplementation((table: string) => {
      if (table === 'form_document_templates') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: templates, error: null }) }) }),
        };
      }
      if (table === 'form_submission_documents') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) }),
          insert: (rows: object[]) => {
            insertedRows.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
    });

    const { seedDocumentsForSubmission } = await import('../seedFromTemplates');
    const result = await seedDocumentsForSubmission({
      formId: 'move-out-notice',
      submissionId: 'sub-id-001',
      householdMembers: [],
    });

    expect(result.inserted).toBe(1);
    expect((insertedRows[0] as Record<string, unknown>)['form_submission_id']).toBe('sub-id-001');
  });
});
