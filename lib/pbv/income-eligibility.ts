import { supabaseAdmin } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IncomeFrequency =
  | 'weekly'
  | 'bi_weekly'
  | 'semi_monthly'
  | 'monthly'
  | 'annual'
  | 'paystubs';

export interface IncomeSourceRecord {
  id: string;
  member_id: string | null;
  source_type: string;
  frequency: IncomeFrequency;
  amount: number | null;
  paystub_count: number | null;
  paystub_amounts: number[] | null;
  annual_amount: number | null;
}

export interface MemberIncomeBreakdown {
  member_id: string | null;
  member_name?: string;
  sources: Array<{
    source_id: string;
    source_type: string;
    frequency: IncomeFrequency;
    annual_amount: number;
  }>;
  member_annual_total: number;
}

export interface EligibilityPayload {
  application_id: string;
  computed_at: string;
  household_size: number;
  msa_code: string;
  effective_year: number;
  ami_pct: number;
  ami_limit: number | null;
  total_household_income: number;
  member_breakdown: MemberIncomeBreakdown[];
  delta: number | null;
  delta_pct: number | null;
  within_tolerance: boolean | null;
  no_income_sources: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Annualization constants
// ─────────────────────────────────────────────────────────────────────────────

export const FREQUENCY_MULTIPLIERS: Record<
  Exclude<IncomeFrequency, 'paystubs'>,
  number
> = {
  weekly:       52,
  bi_weekly:    26,
  semi_monthly: 24,
  monthly:      12,
  annual:        1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Core annualization function (pure — no DB calls)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Annualize a single income source to a yearly dollar amount.
 *
 * For frequency='paystubs':
 *   - paystubAmounts must be an array of individual paystub amounts.
 *   - paystubCount drives the multiplier: 4 = weekly (×52), 2 = bi-weekly (×26).
 *   - Edge cases: empty array or zero count returns 0.
 *
 * All other frequencies: amount × multiplier.
 */
export function annualize(
  amount: number | null | undefined,
  frequency: IncomeFrequency,
  paystubAmounts?: number[] | null,
  paystubCount?: number | null
): number {
  if (frequency === 'paystubs') {
    const amounts = paystubAmounts ?? [];
    if (amounts.length === 0) return 0;
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const count = paystubCount ?? amounts.length;
    // 4 weekly stubs → ×52; 2 bi-weekly → ×26; default to ×26 for safety
    const multiplier = count === 4 ? 52 : count === 2 ? 26 : 26;
    return Math.round(avg * multiplier * 100) / 100;
  }

  if (amount == null || isNaN(amount)) return 0;
  const multiplier = FREQUENCY_MULTIPLIERS[frequency as keyof typeof FREQUENCY_MULTIPLIERS];
  if (multiplier == null) return 0;
  return Math.round(amount * multiplier * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MSA = '25540';
const DEFAULT_AMI_PCT = 50;
const TOLERANCE_PCT = 10; // flag if computed income > AMI limit by more than 10 %

export async function computeHouseholdIncome(
  applicationId: string,
  asOfDate?: Date,
  client = supabaseAdmin
): Promise<EligibilityPayload> {
  const computedAt = (asOfDate ?? new Date()).toISOString();
  const effectiveYear = (asOfDate ?? new Date()).getFullYear();

  // 1. Load application + household size
  const { data: app, error: appErr } = await client
    .from('pbv_full_applications')
    .select('id, household_size, building_address')
    .eq('id', applicationId)
    .single();

  if (appErr || !app) {
    return {
      application_id: applicationId,
      computed_at: computedAt,
      household_size: 0,
      msa_code: DEFAULT_MSA,
      effective_year: effectiveYear,
      ami_pct: DEFAULT_AMI_PCT,
      ami_limit: null,
      total_household_income: 0,
      member_breakdown: [],
      delta: null,
      delta_pct: null,
      within_tolerance: null,
      no_income_sources: true,
      error: `Application not found: ${applicationId}`,
    };
  }

  const householdSize = Math.min(Math.max(app.household_size ?? 1, 1), 8);

  // 2. Load income sources for this application
  const { data: sources, error: srcErr } = await client
    .from('pbv_income_sources')
    .select(
      'id, member_id, source_type, frequency, amount, paystub_count, paystub_amounts, annual_amount'
    )
    .eq('full_application_id', applicationId);

  if (srcErr) {
    return {
      application_id: applicationId,
      computed_at: computedAt,
      household_size: householdSize,
      msa_code: DEFAULT_MSA,
      effective_year: effectiveYear,
      ami_pct: DEFAULT_AMI_PCT,
      ami_limit: null,
      total_household_income: 0,
      member_breakdown: [],
      delta: null,
      delta_pct: null,
      within_tolerance: null,
      no_income_sources: true,
      error: `Failed to load income sources: ${srcErr.message}`,
    };
  }

  if (!sources || sources.length === 0) {
    // No income sources — can still look up AMI limit
    const amiLimit = await lookupAmiLimit(client, DEFAULT_MSA, effectiveYear, DEFAULT_AMI_PCT, householdSize);
    return {
      application_id: applicationId,
      computed_at: computedAt,
      household_size: householdSize,
      msa_code: DEFAULT_MSA,
      effective_year: effectiveYear,
      ami_pct: DEFAULT_AMI_PCT,
      ami_limit: amiLimit,
      total_household_income: 0,
      member_breakdown: [],
      delta: amiLimit != null ? -(amiLimit) : null,
      delta_pct: amiLimit != null ? -100 : null,
      within_tolerance: amiLimit != null ? true : null,
      no_income_sources: true,
    };
  }

  // 3. Load household member names for display
  const memberIds = [...new Set(sources.map((s: any) => s.member_id).filter(Boolean))];
  let memberNames: Record<string, string> = {};
  if (memberIds.length > 0) {
    const { data: members } = await client
      .from('pbv_household_members')
      .select('id, name')
      .in('id', memberIds);
    if (members) {
      memberNames = Object.fromEntries(members.map((m: any) => [m.id, m.name]));
    }
  }

  // 4. Annualize each source and group by member
  const memberMap = new Map<string | null, MemberIncomeBreakdown>();

  for (const src of sources as IncomeSourceRecord[]) {
    const annualAmt = annualize(
      src.amount,
      src.frequency,
      src.paystub_amounts,
      src.paystub_count
    );

    const key = src.member_id ?? '__household__';
    if (!memberMap.has(key)) {
      memberMap.set(key, {
        member_id: src.member_id,
        member_name: src.member_id ? (memberNames[src.member_id] ?? 'Unknown') : 'Household',
        sources: [],
        member_annual_total: 0,
      });
    }

    const entry = memberMap.get(key)!;
    entry.sources.push({
      source_id: src.id,
      source_type: src.source_type,
      frequency: src.frequency,
      annual_amount: annualAmt,
    });
    entry.member_annual_total = Math.round((entry.member_annual_total + annualAmt) * 100) / 100;
  }

  const memberBreakdown = Array.from(memberMap.values());
  const totalHouseholdIncome = Math.round(
    memberBreakdown.reduce((s, m) => s + m.member_annual_total, 0) * 100
  ) / 100;

  // 5. Update annual_amount on each source row (fire-and-forget, non-blocking)
  const sourceUpdates = (sources as IncomeSourceRecord[]).map((src) => {
    const annualAmt = annualize(
      src.amount,
      src.frequency,
      src.paystub_amounts,
      src.paystub_count
    );
    return client
      .from('pbv_income_sources')
      .update({ annual_amount: annualAmt })
      .eq('id', src.id);
  });
  await Promise.allSettled(sourceUpdates);

  // 6. Look up AMI limit
  const amiLimit = await lookupAmiLimit(client, DEFAULT_MSA, effectiveYear, DEFAULT_AMI_PCT, householdSize);

  // 7. Compute delta
  let delta: number | null = null;
  let deltaPct: number | null = null;
  let withinTolerance: boolean | null = null;

  if (amiLimit != null) {
    delta = Math.round((totalHouseholdIncome - amiLimit) * 100) / 100;
    deltaPct = amiLimit > 0
      ? Math.round((delta / amiLimit) * 10000) / 100
      : null;
    withinTolerance = deltaPct != null
      ? deltaPct <= TOLERANCE_PCT
      : totalHouseholdIncome <= amiLimit;
  }

  return {
    application_id: applicationId,
    computed_at: computedAt,
    household_size: householdSize,
    msa_code: DEFAULT_MSA,
    effective_year: effectiveYear,
    ami_pct: DEFAULT_AMI_PCT,
    ami_limit: amiLimit,
    total_household_income: totalHouseholdIncome,
    member_breakdown: memberBreakdown,
    delta,
    delta_pct: deltaPct,
    within_tolerance: withinTolerance,
    no_income_sources: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function lookupAmiLimit(
  client: typeof supabaseAdmin,
  msaCode: string,
  year: number,
  amiPct: number,
  householdSize: number
): Promise<number | null> {
  const { data } = await client
    .from('hud_ami_limits')
    .select('annual_limit')
    .eq('msa_code', msaCode)
    .eq('ami_pct', amiPct)
    .eq('household_size', householdSize)
    .lte('effective_year', year)
    .order('effective_year', { ascending: false })
    .limit(1)
    .single();

  return data?.annual_limit ?? null;
}
