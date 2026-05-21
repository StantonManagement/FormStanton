import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase mock ───────────────────────────────────────────────────────────

type QueryBuilder = {
  select: (...args: any[]) => QueryBuilder;
  eq: (...args: any[]) => QueryBuilder;
  order: (...args: any[]) => QueryBuilder;
  not: (...args: any[]) => QueryBuilder;
  maybeSingle: (...args: any[]) => QueryBuilder;
  then: (fn: (result: any) => any) => Promise<any>;
  count?: number;
  data?: any;
  error?: any;
};

let _mockResponses: Array<{ data: any; count?: number; error?: any }> = [];
let _mockTableName: string | null = null;

function makeBuilder(response: { data: any; count?: number; error?: any }): QueryBuilder {
  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    not: () => builder,
    maybeSingle: () => builder,
    then: (fn) => Promise.resolve(fn(response)),
  };
  return builder;
}

const mockFrom = vi.fn((tableName: string) => {
  _mockTableName = tableName;
  const resp = _mockResponses.shift() ?? { data: [], error: null };
  return makeBuilder(resp);
});

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (tableName: string) => mockFrom(tableName),
  },
}));

import { validateReadyToFinalize } from '../finalizeValidation';

// ── Helpers ─────────────────────────────────────────────────────────────────

function queueResponses(responses: Array<{ data: any; count?: number; error?: any }>) {
  _mockResponses = [...responses];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('validateReadyToFinalize() — PRD-56 F1: canonical pbv_form_documents model', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    _mockResponses = [];
    _mockTableName = null;
  });

  it('S1: returns not ready when intake not submitted (count = 0)', async () => {
    queueResponses([
      { data: null, count: 0 }, // pbv_household_members count
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.signatures[0].doc_label).toMatch(/intake/i);
  });

  it('S1: returns not ready when summary not signed', async () => {
    queueResponses([
      { data: null, count: 2 }, // member count — intake submitted
      { data: null }, // summary not found (not signed)
      { data: [] }, // formDocs — none needed
      { data: [] }, // members
      { data: [] }, // allDocs — no required docs missing
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.signatures.some((s) => s.doc_label.includes('Summary'))).toBe(true);
  });

  it('S1: returns ready when all form docs signed + summary signed', async () => {
    queueResponses([
      { data: null, count: 2 }, // member count — intake submitted
      { data: { id: 'sum-1', signed_at: '2026-05-20T10:00:00Z' } }, // summary signed
      { // formDocs — all signed
        data: [
          { id: 'fd-1', form_id: 'hud_9886a', status: 'signed', required_signer_member_ids: ['m1'], collected_signer_member_ids: ['m1'] },
          { id: 'fd-2', form_id: 'hach_release', status: 'signed', required_signer_member_ids: ['m1'], collected_signer_member_ids: ['m1'] },
        ],
      },
      { data: [{ id: 'm1', name: 'Alice' }] }, // members
      { data: [] }, // allDocs — no required docs missing
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(true);
    expect(result.missing.signatures).toHaveLength(0);
    expect(result.missing.documents).toHaveLength(0);
  });

  it('S1: returns missing signatures when form docs not fully signed (F1 canonical model)', async () => {
    queueResponses([
      { data: null, count: 2 }, // member count
      { data: { id: 'sum-1', signed_at: '2026-05-20T10:00:00Z' } }, // summary signed
      { // formDocs — one not fully signed
        data: [
          { id: 'fd-1', form_id: 'hud_9886a', status: 'signed', required_signer_member_ids: ['m1'], collected_signer_member_ids: ['m1'] },
          { id: 'fd-2', form_id: 'hach_release', status: 'generated', required_signer_member_ids: ['m1', 'm2'], collected_signer_member_ids: ['m1'] }, // m2 missing
        ],
      },
      { data: [{ id: 'm1', name: 'Alice' }, { id: 'm2', name: 'Bob' }] }, // members
      { data: [] }, // allDocs
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.signatures).toHaveLength(1);
    expect(result.missing.signatures[0]).toEqual({
      signer_name: 'Bob',
      doc_label: 'hach release',
      doc_id: 'fd-2',
    });
  });

  it('S1: skips forms with status=skipped (conditional forms)', async () => {
    queueResponses([
      { data: null, count: 2 }, // member count
      { data: { id: 'sum-1', signed_at: '2026-05-20T10:00:00Z' } }, // summary signed
      { // formDocs — includes a skipped conditional form
        data: [
          { id: 'fd-1', form_id: 'main_application', status: 'signed', required_signer_member_ids: ['m1'], collected_signer_member_ids: ['m1'] },
          // pet_addendum with status=skipped won't be returned by .not('status', 'eq', 'skipped')
        ],
      },
      { data: [{ id: 'm1', name: 'Alice' }] }, // members
      { data: [] }, // allDocs
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(true);
  });

  it('S1: reports missing required document in missing.documents', async () => {
    queueResponses([
      { data: null, count: 1 }, // member count
      { data: { id: 'sum-1', signed_at: '2026-05-20T10:00:00Z' } }, // summary signed
      { data: [] }, // formDocs — none needed
      { data: [{ id: 'm1', name: 'Alice' }] }, // members
      { // allDocs — one required doc is missing
        data: [
          { doc_type: 'pay_stub', label: 'Pay Stub', status: 'missing', required: true },
        ],
      },
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.documents).toContain('pay_stub');
  });
});
