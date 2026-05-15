/**
 * tests/e2e/helpers/fillIntakeSection.ts
 *
 * API-level intake section fill helper.
 * POSTs directly to the section auto-save endpoint to avoid UI flakiness
 * on the intake form itself.
 *
 * Usage:
 *   await fillIntakeSection(token, 'household', { ... });
 */

export type SectionName =
  | 'household'
  | 'contact'
  | 'income'
  | 'zero_income'
  | 'expenses'
  | 'assets'
  | 'criminal_history'
  | 'dv_homeless_ra'
  | 'medical'
  | 'certification';

export async function fillIntakeSection(
  baseUrl: string,
  token: string,
  section: SectionName,
  data: Record<string, unknown>
): Promise<void> {
  const url = `${baseUrl}/api/t/${token}/pbv-full-app/intake/${section}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`fillIntakeSection(${section}) failed ${res.status}: ${text}`);
  }
}

/**
 * Fills all intake sections for the Maria household in one call.
 * Corresponds to the conditional triggers in maria-household.json.
 */
export async function fillMariaIntake(baseUrl: string, token: string): Promise<void> {
  await fillIntakeSection(baseUrl, token, 'household', {
    members: [
      { slot: 1, name: 'Maria Garcia-Rodriguez', dob: '1990-03-14', relationship: 'head', citizenship_status: 'citizen', ssn: '100-10-0001', disability: false, student: false, lives_elsewhere: false },
      { slot: 2, name: 'Carlos Garcia-Rodriguez', dob: '1986-07-22', relationship: 'spouse', citizenship_status: 'eligible_non_citizen', ssn: '100-10-0002', disability: false, student: false, lives_elsewhere: false },
      { slot: 3, name: 'Diego Garcia-Rodriguez', dob: '2005-11-05', relationship: 'child', citizenship_status: 'citizen', ssn: '100-10-0003', disability: false, student: false, lives_elsewhere: true },
      { slot: 4, name: 'Sofia Garcia-Rodriguez', dob: '2016-02-18', relationship: 'child', citizenship_status: 'citizen', ssn: '100-10-0004', disability: false, student: true, lives_elsewhere: false },
      { slot: 5, name: 'Lucas Garcia-Rodriguez', dob: '2020-09-30', relationship: 'child', citizenship_status: 'citizen', ssn: '100-10-0005', disability: false, student: false, lives_elsewhere: false },
    ],
  });

  await fillIntakeSection(baseUrl, token, 'contact', {
    phone: '+18605551234',
    email: 'maria@test.invalid',
    mailing_address: '43 Frank Street Apt 2B, Hartford CT 06103',
    preferred_language: 'pt',
  });

  await fillIntakeSection(baseUrl, token, 'income', {
    members: [
      { slot: 1, income_sources: ['employment'], annual_income: 28000 },
      { slot: 2, income_sources: ['employment'], annual_income: 42000 },
      { slot: 3, income_sources: [], annual_income: 0 },
      { slot: 4, income_sources: [], annual_income: 0 },
      { slot: 5, income_sources: [], annual_income: 0 },
    ],
  });

  await fillIntakeSection(baseUrl, token, 'zero_income', {
    zero_income_members: [{ slot: 3, reason: 'between_jobs', expected_income_next_12_months: 0 }],
  });

  await fillIntakeSection(baseUrl, token, 'expenses', {
    has_childcare_expense: false,
    childcare_annual: 0,
    medical_expense_annual: 0,
  });

  await fillIntakeSection(baseUrl, token, 'criminal_history', {
    any_criminal_history: false,
  });

  await fillIntakeSection(baseUrl, token, 'dv_homeless_ra', {
    dv_status: true,
    homeless_at_admission: false,
    reasonable_accommodation_requested: true,
    ra_description: 'Mobility impairment — ground floor unit preferred',
  });

  await fillIntakeSection(baseUrl, token, 'certification', {
    certified: true,
    certification_date: new Date().toISOString().slice(0, 10),
  });
}
