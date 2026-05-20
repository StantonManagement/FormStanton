import { supabaseTestClient } from './supabaseTestClient';

export interface CreateTestApplicationOptions {
  household: { adults: number; children: number };
  buildingAddress?: string;
  unitNumber?: string;
  headOfHouseholdName?: string;
}

export interface CreateTestApplicationResult {
  applicationId: string;
  tenantToken: string;
  formSubmissionId: string;
  buildingAddress: string;
  unitNumber: string;
}

/**
 * Creates a fresh test application with a tenant access token.
 * This is used to set up test scenarios without needing to go through
 * the admin invitation flow.
 */
export async function createTestApplication(
  opts: CreateTestApplicationOptions
): Promise<CreateTestApplicationResult> {
  const buildingAddress = opts.buildingAddress ?? '123 Test Building';
  const unitNumber = opts.unitNumber ?? `Unit-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const headOfHouseholdName = opts.headOfHouseholdName ?? 'Test Applicant';
  const householdSize = opts.household.adults + opts.household.children;

  // Generate unique tokens
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  const formSubmissionToken = `test-fst-${timestamp}-${random}`;
  const appToken = `test-app-${timestamp}-${random}`;

  // Create form_submissions row
  const { data: submission, error: subError } = await supabaseTestClient
    .from('form_submissions')
    .insert({
      form_type: 'pbv-full-application',
      tenant_name: headOfHouseholdName,
      building_address: buildingAddress,
      unit_number: unitNumber,
      language: 'en',
      review_granularity: 'per_document',
      status: 'pending_review',
      tenant_access_token: formSubmissionToken,
      created_by: 'test-harness',
    })
    .select('id')
    .single();

  if (subError || !submission) {
    throw new Error(`Failed to create form_submission: ${subError?.message}`);
  }

  // Create pbv_full_applications row
  const { data: app, error: appError } = await supabaseTestClient
    .from('pbv_full_applications')
    .insert({
      form_submission_id: submission.id,
      building_address: buildingAddress,
      unit_number: unitNumber,
      bedroom_count: 1,
      head_of_household_name: headOfHouseholdName,
      household_size: householdSize,
      tenant_access_token: appToken,
      created_by: 'test-harness',
    })
    .select('id, tenant_access_token')
    .single();

  if (appError || !app) {
    throw new Error(`Failed to create pbv_full_application: ${appError?.message}`);
  }

  return {
    applicationId: app.id,
    tenantToken: app.tenant_access_token,
    formSubmissionId: submission.id,
    buildingAddress,
    unitNumber,
  };
}

/**
 * Creates a test application with household members already populated.
 * This simulates a tenant who has completed the intake step.
 */
export async function createTestApplicationWithIntake(
  opts: CreateTestApplicationOptions & {
    members: Array<{
      name: string;
      dob: string;
      relationship: string;
      ssn: string;
      signature_required?: boolean;
    }>;
  }
): Promise<CreateTestApplicationResult & { memberIds: string[] }> {
  const app = await createTestApplication(opts);
  const memberIds: string[] = [];

  for (let i = 0; i < opts.members.length; i++) {
    const member = opts.members[i];
    const { data: memberRow, error } = await supabaseTestClient
      .from('pbv_household_members')
      .insert({
        full_application_id: app.applicationId,
        name: member.name,
        dob: member.dob,
        relationship: member.relationship,
        ssn_encrypted: member.ssn, // In real app this would be encrypted
        ssn_last_four: member.ssn.slice(-4),
        signature_required: member.signature_required ?? true,
        slot: i + 1,
        is_head_of_household: i === 0,
        income_sources: [],
        annual_income: 0,
      })
      .select('id')
      .single();

    if (error || !memberRow) {
      throw new Error(`Failed to create household member: ${error?.message}`);
    }

    memberIds.push(memberRow.id);
  }

  // Mark intake as submitted
  await supabaseTestClient
    .from('pbv_full_applications')
    .update({ intake_submitted_at: new Date().toISOString() })
    .eq('id', app.applicationId);

  return { ...app, memberIds };
}
