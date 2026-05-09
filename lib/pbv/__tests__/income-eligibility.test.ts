import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {},
}));

import { annualize, computeHouseholdIncome, FREQUENCY_MULTIPLIERS } from '../income-eligibility';

// ─────────────────────────────────────────────────────────────────────────────
// annualize() — pure function tests
// ─────────────────────────────────────────────────────────────────────────────

describe('annualize()', () => {
  it('weekly × 52', () => {
    expect(annualize(500, 'weekly')).toBe(26000);
  });

  it('bi_weekly × 26', () => {
    expect(annualize(1000, 'bi_weekly')).toBe(26000);
  });

  it('semi_monthly × 24', () => {
    expect(annualize(1500, 'semi_monthly')).toBe(36000);
  });

  it('monthly × 12', () => {
    expect(annualize(2000, 'monthly')).toBe(24000);
  });

  it('annual × 1', () => {
    expect(annualize(50000, 'annual')).toBe(50000);
  });

  it('zero amount returns 0', () => {
    expect(annualize(0, 'monthly')).toBe(0);
  });

  it('null amount returns 0', () => {
    expect(annualize(null, 'weekly')).toBe(0);
  });

  it('undefined amount returns 0', () => {
    expect(annualize(undefined, 'monthly')).toBe(0);
  });

  it('fractional dollar amounts round correctly', () => {
    // $750.33 × 52 = $39,017.16
    expect(annualize(750.33, 'weekly')).toBe(39017.16);
  });

  // ── paystubs ─────────────────────────────────────────────────────────────

  it('4 weekly paystubs: averages amounts × 52', () => {
    const stubs = [500, 520, 510, 490];
    const avg = (500 + 520 + 510 + 490) / 4; // 505
    expect(annualize(null, 'paystubs', stubs, 4)).toBe(Math.round(avg * 52 * 100) / 100);
  });

  it('2 bi-weekly paystubs: averages amounts × 26', () => {
    const stubs = [1000, 1100];
    const avg = (1000 + 1100) / 2; // 1050
    expect(annualize(null, 'paystubs', stubs, 2)).toBe(Math.round(avg * 26 * 100) / 100);
  });

  it('paystubs with empty array returns 0', () => {
    expect(annualize(null, 'paystubs', [], 4)).toBe(0);
  });

  it('paystubs with null paystubAmounts returns 0', () => {
    expect(annualize(null, 'paystubs', null, 4)).toBe(0);
  });

  it('paystubs with unrecognized count defaults to bi-weekly (×26)', () => {
    // count=3 is unusual — engine defaults to ×26
    const stubs = [1000, 1000, 1000];
    const avg = 1000;
    expect(annualize(null, 'paystubs', stubs, 3)).toBe(1000 * 26);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FREQUENCY_MULTIPLIERS — sanity checks
// ─────────────────────────────────────────────────────────────────────────────

describe('FREQUENCY_MULTIPLIERS', () => {
  it('has correct values for all non-paystub frequencies', () => {
    expect(FREQUENCY_MULTIPLIERS.weekly).toBe(52);
    expect(FREQUENCY_MULTIPLIERS.bi_weekly).toBe(26);
    expect(FREQUENCY_MULTIPLIERS.semi_monthly).toBe(24);
    expect(FREQUENCY_MULTIPLIERS.monthly).toBe(12);
    expect(FREQUENCY_MULTIPLIERS.annual).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeHouseholdIncome() — integration-style tests with mocked Supabase
// ─────────────────────────────────────────────────────────────────────────────

function makeSupabaseMock(overrides: {
  app?: any;
  sources?: any[];
  members?: any[];
  amiLimit?: number | null;
}) {
  const { app, sources = [], members = [], amiLimit = 54900 } = overrides;

  // Each .from() call returns a chainable builder that resolves based on table name
  const mockClient = {
    from: (table: string) => {
      if (table === 'pbv_full_applications') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: app,
                error: app ? null : { message: 'not found' },
              }),
            }),
          }),
        };
      }
      if (table === 'pbv_income_sources') {
        return {
          select: () => ({
            eq: () => ({
              data: sources,
              error: null,
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === 'pbv_household_members') {
        return {
          select: () => ({
            in: () => ({
              data: members,
              error: null,
            }),
          }),
        };
      }
      if (table === 'hud_ami_limits') {
        return {
          select: () => ({
            eq: (_c: string, _v: any) => ({
              eq: (_c: string, _v: any) => ({
                eq: (_c: string, _v: any) => ({
                  lte: () => ({
                    order: () => ({
                      limit: () => ({
                        single: async () => ({
                          data: amiLimit != null ? { annual_limit: amiLimit } : null,
                          error: amiLimit != null ? null : { message: 'no row' },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) };
    },
  } as any;

  return mockClient;
}

describe('computeHouseholdIncome()', () => {
  it('returns no_income_sources=true when no sources exist', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-1', household_size: 3, total_annual_income: 0 },
      sources: [],
      amiLimit: 49450,
    });
    const result = await computeHouseholdIncome('app-1', undefined, client);
    expect(result.no_income_sources).toBe(true);
    expect(result.total_household_income).toBe(0);
    expect(result.ami_limit).toBe(49450);
    expect(result.within_tolerance).toBe(true); // 0 documented, 0 claimed — delta=0 < $2,400
  });

  it('returns error payload when application not found', async () => {
    const client = makeSupabaseMock({ app: null, sources: [] });
    const result = await computeHouseholdIncome('bad-id', undefined, client);
    expect(result.error).toBeDefined();
    expect(result.no_income_sources).toBe(true);
  });

  it('single member — monthly income annualizes correctly', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-2', household_size: 1, total_annual_income: 24000 },
      sources: [
        {
          id: 's1',
          member_id: 'm1',
          source_type: 'employment',
          frequency: 'monthly',
          amount: 2000,
          paystub_count: null,
          paystub_amounts: null,
          annual_amount: null,
        },
      ],
      members: [{ id: 'm1', name: 'Alice' }],
      amiLimit: 38450,
    });
    const result = await computeHouseholdIncome('app-2', undefined, client);
    expect(result.total_household_income).toBe(24000); // 2000 × 12
    expect(result.ami_limit).toBe(38450);
    expect(result.claimed_annual).toBe(24000);
    expect(result.delta).toBe(0); // documented matches claimed exactly
    expect(result.within_tolerance).toBe(true);
    expect(result.qualifies_under_ami).toBe(true); // 24000 <= 38450
  });

  it('multi-member household sums all member incomes', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-3', household_size: 4, total_annual_income: 34092 },
      sources: [
        {
          id: 's1', member_id: 'm1', source_type: 'employment',
          frequency: 'monthly', amount: 2000, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
        {
          id: 's2', member_id: 'm2', source_type: 'ssi',
          frequency: 'monthly', amount: 841, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
      ],
      members: [
        { id: 'm1', name: 'Alice' },
        { id: 'm2', name: 'Bob' },
      ],
      amiLimit: 54900,
    });
    const result = await computeHouseholdIncome('app-3', undefined, client);
    // Alice: 2000×12 = 24000; Bob: 841×12 = 10092; total = 34092
    expect(result.total_household_income).toBe(34092);
    expect(result.member_breakdown).toHaveLength(2);
    expect(result.delta).toBe(0); // documented matches claimed exactly
    expect(result.within_tolerance).toBe(true);
  });

  it('handles zero income from single weekly source', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-6', household_size: 2, total_annual_income: 0 },
      sources: [
        {
          id: 's1', member_id: 'm1', source_type: 'employment',
          frequency: 'weekly', amount: 0, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
      ],
      members: [{ id: 'm1', name: 'Charlie' }],
      amiLimit: 43950,
    });
    const result = await computeHouseholdIncome('app-6', undefined, client);
    expect(result.total_household_income).toBe(0);
    expect(result.no_income_sources).toBe(false);
    expect(result.within_tolerance).toBe(true); // 0 documented, 0 claimed — delta=0 < $2,400
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// qualifies_under_ami — documented income vs AMI limit
// ─────────────────────────────────────────────────────────────────────────────

describe('qualifies_under_ami', () => {
  it('documented income over AMI limit → qualifies_under_ami: false', async () => {
    const amiLimit = 38450;
    const client = makeSupabaseMock({
      app: { id: 'qa-1', household_size: 1, total_annual_income: 38450 },
      sources: [
        {
          id: 's1', member_id: 'm1', source_type: 'employment',
          frequency: 'monthly', amount: 4000, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
      ],
      members: [{ id: 'm1', name: 'Alice' }],
      amiLimit,
    });
    const result = await computeHouseholdIncome('qa-1', undefined, client);
    expect(result.total_household_income).toBe(48000);
    expect(result.qualifies_under_ami).toBe(false); // 48000 > 38450
  });

  it('documented income exactly at AMI limit → qualifies_under_ami: true', async () => {
    const amiLimit = 38450;
    const client = makeSupabaseMock({
      app: { id: 'qa-2', household_size: 1, total_annual_income: 38450 },
      sources: [
        {
          id: 's1', member_id: null, source_type: 'pension',
          frequency: 'annual', amount: amiLimit, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
      ],
      members: [],
      amiLimit,
    });
    const result = await computeHouseholdIncome('qa-2', undefined, client);
    expect(result.total_household_income).toBe(amiLimit);
    expect(result.qualifies_under_ami).toBe(true); // documented <= AMI limit
    expect(result.delta).toBe(0); // documented matches claimed
    expect(result.within_tolerance).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HUD EIV discrepancy standard — within_tolerance
// ─────────────────────────────────────────────────────────────────────────────

function makeEivMock(
  applicationId: string,
  claimedAnnual: number | null,
  documentedAnnual: number
) {
  return makeSupabaseMock({
    app: {
      id: applicationId,
      household_size: 1,
      total_annual_income: claimedAnnual,
    },
    sources:
      documentedAnnual === 0
        ? [
            {
              id: 's1', member_id: null, source_type: 'other',
              frequency: 'annual' as const, amount: 0,
              paystub_count: null, paystub_amounts: null, annual_amount: null,
            },
          ]
        : [
            {
              id: 's1', member_id: null, source_type: 'other',
              frequency: 'annual' as const, amount: documentedAnnual,
              paystub_count: null, paystub_amounts: null, annual_amount: null,
            },
          ],
    members: [],
    amiLimit: 99999,
  });
}

describe('HUD EIV within_tolerance', () => {
  it('documented income exactly matches claimed → within_tolerance: true', async () => {
    const client = makeEivMock('eiv-1', 40000, 40000);
    const result = await computeHouseholdIncome('eiv-1', undefined, client);
    expect(result.delta).toBe(0);
    expect(result.within_tolerance).toBe(true);
  });

  it('documented exceeds claimed by $2,000 and < 10% → within_tolerance: true (both thresholds pass)', async () => {
    const client = makeEivMock('eiv-2', 40000, 42000);
    const result = await computeHouseholdIncome('eiv-2', undefined, client);
    expect(result.delta).toBe(2000);
    expect(result.within_tolerance).toBe(true); // |2000| < 2400, |2000/40000|=0.05 < 0.10
  });

  it('documented exceeds claimed by $3,000 and < 10% → within_tolerance: false (absolute threshold fails)', async () => {
    const client = makeEivMock('eiv-3', 40000, 43000);
    const result = await computeHouseholdIncome('eiv-3', undefined, client);
    expect(result.delta).toBe(3000);
    expect(result.within_tolerance).toBe(false); // |3000| >= 2400
  });

  it('documented exceeds claimed by 12% and < $2,400 → within_tolerance: false (percentage threshold fails)', async () => {
    const client = makeEivMock('eiv-4', 10000, 11200);
    const result = await computeHouseholdIncome('eiv-4', undefined, client);
    expect(result.delta).toBe(1200);
    expect(result.within_tolerance).toBe(false); // |1200/10000|=0.12 >= 0.10
  });

  it('documented under claimed by $5,000 → within_tolerance: false (under-reporting discrepancy)', async () => {
    const client = makeEivMock('eiv-5', 40000, 35000);
    const result = await computeHouseholdIncome('eiv-5', undefined, client);
    expect(result.delta).toBe(-5000);
    expect(result.within_tolerance).toBe(false); // |−5000| >= 2400
  });

  it('claimed = $0, documented = $1,500 → within_tolerance: true (under absolute threshold)', async () => {
    const client = makeEivMock('eiv-6', 0, 1500);
    const result = await computeHouseholdIncome('eiv-6', undefined, client);
    expect(result.delta).toBe(1500);
    expect(result.delta_pct).toBeNull(); // percentage check skipped for zero claimed
    expect(result.within_tolerance).toBe(true); // |1500| < 2400
  });

  it('claimed = $0, documented = $3,000 → within_tolerance: false (over absolute threshold)', async () => {
    const client = makeEivMock('eiv-7', 0, 3000);
    const result = await computeHouseholdIncome('eiv-7', undefined, client);
    expect(result.delta).toBe(3000);
    expect(result.delta_pct).toBeNull(); // percentage check skipped for zero claimed
    expect(result.within_tolerance).toBe(false); // |3000| >= 2400
  });

  it('claimed = $0, documented = $0 → within_tolerance: true', async () => {
    const client = makeEivMock('eiv-8', 0, 0);
    const result = await computeHouseholdIncome('eiv-8', undefined, client);
    expect(result.delta).toBe(0);
    expect(result.delta_pct).toBeNull();
    expect(result.within_tolerance).toBe(true); // |0| < 2400
  });

  it('claimed = null (data missing) → within_tolerance: null', async () => {
    const client = makeEivMock('eiv-9', null, 40000);
    const result = await computeHouseholdIncome('eiv-9', undefined, client);
    expect(result.claimed_annual).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.delta_pct).toBeNull();
    expect(result.within_tolerance).toBeNull();
  });
});
