/**
 * tests/e2e/helpers/createMariaApplication.ts
 *
 * Creates the canonical PRD-30 Maria Garcia-Rodriguez test application
 * with all 5 household members and the correct conditional triggers.
 * Returns application ID, tenant token, and member IDs keyed by slot.
 */

import { supabaseTestClient } from './supabaseTestClient';
import mariaFixture from '../../fixtures/maria-household.json';

export interface MariaApplicationResult {
  applicationId: string;
  tenantToken: string;
  formSubmissionId: string;
  memberIds: Record<number, string>;
}

export async function createMariaApplication(): Promise<MariaApplicationResult> {
  const timestamp = Date.now();
  const appToken = `test-maria-${timestamp}`;

  const { data: submission, error: subError } = await supabaseTestClient
    .from('form_submissions')
    .insert({
      form_type: 'pbv-full-application',
      tenant_name: mariaFixture.application.head_of_household_name,
      building_address: mariaFixture.application.building_address,
      unit_number: `${mariaFixture.application.unit_number}-${timestamp}`,
      language: mariaFixture.application.preferred_language,
      review_granularity: 'per_document',
      status: 'pending_review',
      tenant_access_token: `${appToken}-sub`,
      created_by: 'test-harness',
    })
    .select('id')
    .single();

  if (subError || !submission) {
    throw new Error(`createMariaApplication: form_submission failed: ${subError?.message}`);
  }

  const { data: app, error: appError } = await supabaseTestClient
    .from('pbv_full_applications')
    .insert({
      form_submission_id: submission.id,
      building_address: mariaFixture.application.building_address,
      unit_number: `${mariaFixture.application.unit_number}-${timestamp}`,
      bedroom_count: mariaFixture.application.bedroom_count,
      head_of_household_name: mariaFixture.application.head_of_household_name,
      household_size: mariaFixture.members.length,
      tenant_access_token: appToken,
      preferred_language: mariaFixture.application.preferred_language,
      created_by: 'test-harness',
    })
    .select('id, tenant_access_token')
    .single();

  if (appError || !app) {
    throw new Error(`createMariaApplication: pbv_full_applications failed: ${appError?.message}`);
  }

  const memberIds: Record<number, string> = {};

  for (const member of mariaFixture.members) {
    const { data: m, error: mErr } = await supabaseTestClient
      .from('pbv_household_members')
      .insert({
        full_application_id: app.id,
        slot: member.slot,
        name: member.name,
        dob: member.dob,
        relationship: member.relationship,
        citizenship_status: member.citizenship_status,
        ssn_encrypted: member.ssn,
        ssn_last_four: member.ssn.slice(-4),
        signature_required: member.signature_required,
        is_head_of_household: member.is_head_of_household,
        income_sources: member.income_sources,
        annual_income: member.annual_income,
        disability: member.disability,
        student: member.student,
        lives_elsewhere: member.lives_elsewhere,
      })
      .select('id')
      .single();

    if (mErr || !m) {
      throw new Error(`createMariaApplication: member ${member.name} failed: ${mErr?.message}`);
    }

    memberIds[member.slot] = m.id;
  }

  return {
    applicationId: app.id,
    tenantToken: app.tenant_access_token,
    formSubmissionId: submission.id,
    memberIds,
  };
}
