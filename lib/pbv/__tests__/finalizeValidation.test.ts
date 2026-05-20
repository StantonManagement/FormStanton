import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase mock ───────────────────────────────────────────────────────────

type QueryBuilder = {
  select: (...args: any[]) => QueryBuilder;
  eq: (...args: any[]) => QueryBuilder;
  order: (...args: any[]) => QueryBuilder;
  then: (fn: (result: any) => any) => Promise<any>;
  count?: number;
  data?: any;
  error?: any;
};

let _mockResponses: Array<{ data: any; count?: number; error?: any }> = [];

function makeBuilder(response: { data: any; count?: number; error?: any }): QueryBuilder {
  const builder: QueryBuilder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (fn) => Promise.resolve(fn(response)),
  };
  return builder;
}

const mockFrom = vi.fn((_tableName: string) => {
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

describe('validateReadyToFinalize()', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    _mockResponses = [];
  });

  it('returns not ready when intake not submitted (count = 0)', async () => {
    queueResponses([
      { data: null, count: 0 }, // pbv_household_members count
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.signatures[0].doc_label).toMatch(/intake/i);
  });

  it('returns ready when all sigs and docs are complete', async () => {
    queueResponses([
      { data: null, count: 2 }, // member count — intake submitted
      { data: [{ id: 'm1', slot: 1, name: 'Alice', signature_required: true }] }, // sigMembers
      { data: [{ id: 'd1', label: 'HUD-9886-A', person_slot: 1, signer_scope: 'all_adults', status: 'submitted', requires_signature: true }] }, // signatureDocs
      { data: [] }, // allDocs — no required docs missing
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(true);
    expect(result.missing.signatures).toHaveLength(0);
    expect(result.missing.documents).toHaveLength(0);
  });

  it('returns per-signer attributed missing signature for 2-adult app with one unsigned doc', async () => {
    queueResponses([
      { data: null, count: 2 }, // member count
      { // sigMembers — two adults
        data: [
          { id: 'm1', slot: 1, name: 'Alice', signature_required: true },
          { id: 'm2', slot: 2, name: 'Bob', signature_required: true },
        ],
      },
      { // signatureDocs — one doc per adult slot
        data: [
          { id: 'd1', label: 'HUD-9886-A', person_slot: 1, signer_scope: 'all_adults', status: 'submitted', requires_signature: true },
          { id: 'd2', label: 'HUD-9886-A', person_slot: 2, signer_scope: 'all_adults', status: 'missing', requires_signature: true },
        ],
      },
      { data: [] }, // allDocs — no non-signature required docs missing
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.signatures).toHaveLength(1);
    expect(result.missing.signatures[0]).toEqual({
      signer_name: 'Bob',
      doc_label: 'HUD-9886-A',
      doc_id: 'd2',
    });
  });

  it('reports missing required document in missing.documents', async () => {
    queueResponses([
      { data: null, count: 1 }, // member count
      { data: [{ id: 'm1', slot: 1, name: 'Alice', signature_required: true }] }, // sigMembers
      { data: [{ id: 'd1', label: 'HUD-9886-A', person_slot: 1, signer_scope: 'all_adults', status: 'submitted', requires_signature: true }] }, // signatureDocs — all signed
      { // allDocs — one required doc is missing
        data: [
          { doc_type: 'pay_stub', label: 'Pay Stub', status: 'missing', required: true },
        ],
      },
    ]);

    const result = await validateReadyToFinalize('app-1');
    expect(result.ready).toBe(false);
    expect(result.missing.documents).toContain('pay_stub');
    expect(result.missing.signatures).toHaveLength(0);
  });
});
