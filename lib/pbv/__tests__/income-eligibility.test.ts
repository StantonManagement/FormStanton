import { describe, it, expect } from 'vitest';
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
      app: { id: 'app-1', household_size: 3 },
      sources: [],
      amiLimit: 49450,
    });
    const result = await computeHouseholdIncome('app-1', undefined, client);
    expect(result.no_income_sources).toBe(true);
    expect(result.total_household_income).toBe(0);
    expect(result.ami_limit).toBe(49450);
    expect(result.within_tolerance).toBe(true); // 0 income is well within AMI
  });

  it('returns error payload when application not found', async () => {
    const client = makeSupabaseMock({ app: null, sources: [] });
    const result = await computeHouseholdIncome('bad-id', undefined, client);
    expect(result.error).toBeDefined();
    expect(result.no_income_sources).toBe(true);
  });

  it('single member — monthly income annualizes correctly', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-2', household_size: 1 },
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
    expect(result.delta).toBe(24000 - 38450);
    expect(result.within_tolerance).toBe(true); // under the limit
  });

  it('multi-member household sums all member incomes', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-3', household_size: 4 },
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
    expect(result.within_tolerance).toBe(true);
  });

  it('flags income over AMI limit + tolerance', async () => {
    const amiLimit = 38450;
    const monthlyAmount = 4000; // 48000 annualized — 24.9% over limit
    const client = makeSupabaseMock({
      app: { id: 'app-4', household_size: 1 },
      sources: [
        {
          id: 's1', member_id: 'm1', source_type: 'employment',
          frequency: 'monthly', amount: monthlyAmount, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
      ],
      members: [{ id: 'm1', name: 'Alice' }],
      amiLimit,
    });
    const result = await computeHouseholdIncome('app-4', undefined, client);
    expect(result.total_household_income).toBe(48000);
    expect(result.delta).toBeGreaterThan(0);
    expect(result.within_tolerance).toBe(false);
  });

  it('income exactly at AMI limit is within tolerance', async () => {
    const amiLimit = 38450;
    const client = makeSupabaseMock({
      app: { id: 'app-5', household_size: 1 },
      sources: [
        {
          id: 's1', member_id: null, source_type: 'pension',
          frequency: 'annual', amount: amiLimit, paystub_count: null, paystub_amounts: null, annual_amount: null,
        },
      ],
      members: [],
      amiLimit,
    });
    const result = await computeHouseholdIncome('app-5', undefined, client);
    expect(result.total_household_income).toBe(amiLimit);
    expect(result.delta).toBe(0);
    expect(result.within_tolerance).toBe(true);
  });

  it('handles zero income from single weekly source', async () => {
    const client = makeSupabaseMock({
      app: { id: 'app-6', household_size: 2 },
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
    expect(result.within_tolerance).toBe(true);
  });
});
