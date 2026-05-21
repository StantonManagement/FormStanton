/**
 * tests/e2e/helpers/createProfileApplication.ts
 *
 * PRD-61: builds a fully-seeded test application from a profile fixture.
 *
 * Differs from createTestApplicationWithIntake in two ways:
 *  - accepts rich member fields (income_sources, annual_income, has_child_support,
 *    has_self_employment, etc.) that the existing helper drops.
 *  - seeds pbv_full_applications.intake_data with the profile's intake_data block
 *    so conditional rules in lib/pbv/conditional-rules.ts evaluate correctly when
 *    /generate-forms runs.
 *
 * Reuses createTestApplication for the form_submissions + pbv_full_applications
 * row creation so token/foreign-key conventions stay identical to PRD-30.
 */

import { supabaseTestClient } from './supabaseTestClient';
import { createTestApplication } from './createTestApplication';

export interface ProfileMember {
  slot: number;
  name: string;
  dob: string;
  relationship: string;
  citizenship_status?: string;
  ssn: string;
  signature_required?: boolean;
  is_head_of_household?: boolean;
  income_sources?: string[];
  annual_income?: number;
  has_child_support?: boolean;
  has_self_employment?: boolean;
  disability?: boolean;
  student?: boolean;
}

export interface ProfileFixture {
  profile_key: string;
  application: {
    building_address: string;
    unit_number: string;
    bedroom_count?: number;
    preferred_language: 'en' | 'es' | 'pt';
    head_of_household_name: string;
  };
  members: ProfileMember[];
  intake_data: Record<string, unknown>;
}

export interface CreateProfileApplicationResult {
  applicationId: string;
  tenantToken: string;
  formSubmissionId: string;
  memberIds: Record<number, string>;
  profileKey: string;
}

export async function createProfileApplication(
  fixture: ProfileFixture
): Promise<CreateProfileApplicationResult> {
  const adults = fixture.members.filter((m) => yearsBetween(m.dob, new Date()) >= 18).length;
  const children = fixture.members.length - adults;

  const app = await createTestApplication({
    household: { adults, children },
    buildingAddress: fixture.application.building_address,
    unitNumber: `${fixture.application.unit_number}-${fixture.profile_key}-${Date.now()}`,
    headOfHouseholdName: fixture.application.head_of_household_name,
  });

  const memberIds: Record<number, string> = {};

  for (const m of fixture.members) {
    const { data: row, error } = await supabaseTestClient
      .from('pbv_household_members')
      .insert({
        full_application_id: app.applicationId,
        slot: m.slot,
        name: m.name,
        dob: m.dob,
        relationship: m.relationship,
        citizenship_status: m.citizenship_status ?? 'citizen',
        ssn_encrypted: m.ssn,
        ssn_last_four: m.ssn.slice(-4),
        signature_required: m.signature_required ?? true,
        is_head_of_household: m.is_head_of_household ?? m.slot === 1,
        income_sources: m.income_sources ?? [],
        annual_income: m.annual_income ?? 0,
        has_child_support: m.has_child_support ?? false,
        has_self_employment: m.has_self_employment ?? false,
        disability: m.disability ?? false,
        student: m.student ?? false,
      })
      .select('id')
      .single();

    if (error || !row) {
      throw new Error(
        `createProfileApplication(${fixture.profile_key}): failed inserting member slot ${m.slot}: ${error?.message}`
      );
    }
    memberIds[m.slot] = row.id;
  }

  const { error: updateErr } = await supabaseTestClient
    .from('pbv_full_applications')
    .update({
      preferred_language: fixture.application.preferred_language,
      bedroom_count: fixture.application.bedroom_count ?? 1,
      intake_data: fixture.intake_data,
      intake_submitted_at: new Date().toISOString(),
    })
    .eq('id', app.applicationId);

  if (updateErr) {
    throw new Error(
      `createProfileApplication(${fixture.profile_key}): failed seeding intake_data: ${updateErr.message}`
    );
  }

  return {
    applicationId: app.applicationId,
    tenantToken: app.tenantToken,
    formSubmissionId: app.formSubmissionId,
    memberIds,
    profileKey: fixture.profile_key,
  };
}

function yearsBetween(dobIso: string, asOf: Date): number {
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return 99;
  let years = asOf.getFullYear() - dob.getFullYear();
  const monthDiff = asOf.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < dob.getDate())) {
    years--;
  }
  return years;
}
