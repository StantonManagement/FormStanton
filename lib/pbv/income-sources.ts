import { supabaseAdmin } from '@/lib/supabase';
import { IncomeFrequency } from './income-eligibility';

// ─────────────────────────────────────────────────────────────────────────────
// syncIncomeSourcesFromIntake
//
// Reads the intake form_data JSONB from the application's linked form_submission
// and upserts rows into pbv_income_sources.
//
// Strategy: delete all existing synced_from_intake=true rows, then reinsert.
// This keeps the table clean on re-sync without destroying manually entered sources.
// ─────────────────────────────────────────────────────────────────────────────

export async function syncIncomeSourcesFromIntake(
  applicationId: string,
  client = supabaseAdmin
): Promise<{ synced: number; error?: string }> {
  // 1. Load application with its form_submission link
  const { data: app, error: appErr } = await client
    .from('pbv_full_applications')
    .select('id, form_submission_id')
    .eq('id', applicationId)
    .single();

  if (appErr || !app) {
    return { synced: 0, error: `Application not found: ${applicationId}` };
  }

  if (!app.form_submission_id) {
    return { synced: 0, error: 'Application has no linked form submission' };
  }

  // 2. Load form submission data
  const { data: submission, error: subErr } = await client
    .from('form_submissions')
    .select('form_data')
    .eq('id', app.form_submission_id)
    .single();

  if (subErr || !submission?.form_data) {
    return { synced: 0, error: 'Form submission not found or empty form_data' };
  }

  const formData = submission.form_data as Record<string, any>;

  // 3. Load household members to get their DB IDs (matched by slot/index)
  const { data: members } = await client
    .from('pbv_household_members')
    .select('id, slot, name, income_sources, annual_income')
    .eq('full_application_id', applicationId)
    .order('slot');

  // 4. Delete existing intake-synced rows
  await client
    .from('pbv_income_sources')
    .delete()
    .eq('full_application_id', applicationId)
    .eq('synced_from_intake', true);

  // 5. Parse income sources from household_members in form_data
  const householdMembers: any[] =
    formData.household_members ?? formData.householdMembers ?? [];

  const rows: Record<string, any>[] = [];

  for (let i = 0; i < householdMembers.length; i++) {
    const fm = householdMembers[i];
    const dbMember = members?.find((m) => m.slot === i + 1) ?? null;

    // Extract income sources from the form member's declared sources
    const incomeSources: string[] = fm.income_sources ?? fm.incomeSources ?? [];
    const monthlyAmount: number | null = fm.monthly_income ?? fm.monthlyIncome ?? null;
    const annualAmount: number | null = fm.annual_income ?? fm.annualIncome ?? null;

    if (incomeSources.length === 0 && !monthlyAmount && !annualAmount) continue;

    // If only a single aggregate income figure with no breakdown, create one row
    if (incomeSources.length === 0 && (monthlyAmount || annualAmount)) {
      rows.push({
        full_application_id: applicationId,
        member_id: dbMember?.id ?? null,
        source_type: 'other',
        frequency: monthlyAmount ? 'monthly' : 'annual',
        amount: monthlyAmount ?? annualAmount,
        synced_from_intake: true,
        created_by: 'intake_sync',
      });
      continue;
    }

    // Map each declared income source to a pbv_income_sources row
    for (const sourceType of incomeSources) {
      const row = buildIncomeSourceRow({
        applicationId,
        memberId: dbMember?.id ?? null,
        sourceType,
        fm,
      });
      if (row) rows.push(row);
    }
  }

  // 6. Insert new rows
  if (rows.length === 0) {
    return { synced: 0 };
  }

  const { error: insertErr } = await client
    .from('pbv_income_sources')
    .insert(rows);

  if (insertErr) {
    return { synced: 0, error: `Insert failed: ${insertErr.message}` };
  }

  return { synced: rows.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Map a form income_source string to a pbv_income_sources row shape.
// Frequency defaults to 'monthly' when not determinable from form data.
// ─────────────────────────────────────────────────────────────────────────────

function buildIncomeSourceRow({
  applicationId,
  memberId,
  sourceType,
  fm,
}: {
  applicationId: string;
  memberId: string | null;
  sourceType: string;
  fm: Record<string, any>;
}): Record<string, any> | null {
  // Map source_type strings from intake form to frequency
  const frequencyMap: Record<string, IncomeFrequency> = {
    employment:       'bi_weekly',
    wages:            'bi_weekly',
    self_employment:  'monthly',
    ssi:              'monthly',
    ss:               'monthly',
    social_security:  'monthly',
    pension:          'monthly',
    tanf:             'monthly',
    child_support:    'monthly',
    unemployment:     'weekly',
    other:            'monthly',
  };

  const frequency: IncomeFrequency = frequencyMap[sourceType] ?? 'monthly';

  // Try to extract a per-source amount from form_data
  const amountKey = `${sourceType}_amount`;
  const monthlyKey = `${sourceType}_monthly`;
  const amount: number | null =
    fm[amountKey] ?? fm[monthlyKey] ?? fm.monthly_income ?? fm.monthlyIncome ?? null;

  return {
    full_application_id: applicationId,
    member_id: memberId,
    source_type: sourceType,
    frequency,
    amount,
    synced_from_intake: true,
    created_by: 'intake_sync',
  };
}
