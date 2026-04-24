/**
 * seed-hach-test-data.ts
 * Creates 3 test PBV full applications for HACH reviewer portal testing.
 *
 * Run: npx ts-node scripts/seed-hach-test-data.ts
 *
 * Apps:
 *  1. Maria Santos — 43 Frank St 1A — "Needs First Review" (all docs missing, no review actions)
 *  2. James Okafor — 118 Wethersfield Ave 2B — "Awaiting Response" (mixed approved/rejected)
 *  3. Li Wei — 88 Hungerford Dr 5C — "Approved This Week" (all docs approved, hach_review_status=approved_by_hach)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

async function upsertFormSubmission(params: {
  formType: string;
  tenantName: string;
  buildingAddress: string;
  unitNumber: string;
  formData: Record<string, any>;
  submittedDaysAgo: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from('form_submissions')
    .insert({
      form_type: params.formType,
      tenant_name: params.tenantName,
      building_address: params.buildingAddress,
      unit_number: params.unitNumber,
      form_data: params.formData,
      submitted_at: daysAgo(params.submittedDaysAgo),
      review_granularity: 'per_document',
    })
    .select('id')
    .single();
  if (error) throw new Error(`form_submissions insert: ${error.message}`);
  return data!.id;
}

async function upsertFullApplication(params: {
  formSubmissionId: string;
  headOfHouseholdName: string;
  buildingAddress: string;
  unitNumber: string;
  householdSize: number;
  hachStatus?: string | null;
  stantonStatus?: string;
  createdDaysAgo: number;
}): Promise<string> {
  const { data, error } = await supabase
    .from('pbv_full_applications')
    .insert({
      form_submission_id: params.formSubmissionId,
      head_of_household_name: params.headOfHouseholdName,
      building_address: params.buildingAddress,
      unit_number: params.unitNumber,
      household_size: params.householdSize,
      hach_review_status: params.hachStatus ?? null,
      stanton_review_status: params.stantonStatus ?? 'under_review',
      created_at: daysAgo(params.createdDaysAgo),
      created_by: 'seed_script',
    })
    .select('id')
    .single();
  if (error) throw new Error(`pbv_full_applications insert: ${error.message}`);
  return data!.id;
}

async function insertHouseholdMembers(
  applicationId: string,
  members: Array<{
    slot: number;
    name: string;
    relationship: string;
    dateOfBirth?: string;
    annualIncome?: number;
    incomeSources?: string[];
    employed?: boolean;
    hasSsi?: boolean;
  }>
): Promise<void> {
  for (const m of members) {
    const age = m.dateOfBirth
      ? Math.floor((now.getTime() - new Date(m.dateOfBirth).getTime()) / (365.25 * 86400000))
      : undefined;
    const { error } = await supabase.from('pbv_household_members').insert({
      full_application_id: applicationId,
      slot: m.slot,
      name: m.name,
      relationship: m.relationship,
      date_of_birth: m.dateOfBirth ?? null,
      age: age ?? null,
      annual_income: m.annualIncome ?? 0,
      income_sources: m.incomeSources ?? [],
      employed: m.employed ?? false,
      has_ssi: m.hasSsi ?? false,
      created_by: 'seed_script',
    });
    if (error) throw new Error(`pbv_household_members insert (slot ${m.slot}): ${error.message}`);
  }
}

async function insertDocumentSlots(
  formSubmissionId: string,
  docs: Array<{
    docType: string;
    label: string;
    status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';
    fileName?: string;
    displayOrder: number;
  }>
): Promise<string[]> {
  const ids: string[] = [];
  for (const doc of docs) {
    const { data, error } = await supabase
      .from('form_submission_documents')
      .insert({
        form_submission_id: formSubmissionId,
        doc_type: doc.docType,
        label: doc.label,
        status: doc.status,
        file_name: doc.fileName ?? null,
        display_order: doc.displayOrder,
        required: true,
        created_by: 'seed_script',
      })
      .select('id')
      .single();
    if (error) throw new Error(`form_submission_documents insert (${doc.docType}): ${error.message}`);
    ids.push(data!.id);
  }
  return ids;
}

async function insertReviewActions(
  documentId: string,
  applicationId: string,
  action: 'approved' | 'rejected' | 'needs_info' | 'waived',
  rejectionReason?: string
): Promise<void> {
  const { error } = await supabase.from('document_review_actions').insert({
    document_id: documentId,
    full_application_id: applicationId,
    reviewer_name: 'HACH Test Reviewer',
    action,
    rejection_reason: rejectionReason ?? null,
    created_by: 'seed_script',
  });
  if (error) throw new Error(`document_review_actions insert: ${error.message}`);
}

async function insertIncomeSources(
  applicationId: string,
  memberId: string | null,
  sources: Array<{ sourceType: string; frequency: string; amount: number }>
): Promise<void> {
  for (const s of sources) {
    const { error } = await supabase.from('pbv_income_sources').insert({
      full_application_id: applicationId,
      member_id: memberId,
      source_type: s.sourceType,
      frequency: s.frequency,
      amount: s.amount,
      synced_from_intake: false,
      created_by: 'seed_script',
    });
    if (error) console.warn(`  ⚠ income_sources insert: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding HACH test data…\n');

  // ── App 1: Maria Santos — Needs First Review ─────────────────────────────
  console.log('Creating App 1: Maria Santos (Needs First Review)…');
  const sub1Id = await upsertFormSubmission({
    formType: 'pbv-full-application',
    tenantName: 'Maria Santos',
    buildingAddress: '43 Frank Street',
    unitNumber: '1A',
    formData: { test: true, seed: 'hach-portal' },
    submittedDaysAgo: 3,
  });
  const app1Id = await upsertFullApplication({
    formSubmissionId: sub1Id,
    headOfHouseholdName: 'Maria Santos',
    buildingAddress: '43 Frank Street',
    unitNumber: '1A',
    householdSize: 5,
    hachStatus: 'pending_hach',
    createdDaysAgo: 3,
  });
  await insertHouseholdMembers(app1Id, [
    { slot: 1, name: 'Maria Santos', relationship: 'head', dateOfBirth: '1985-03-14', annualIncome: 24000, incomeSources: ['employment'], employed: true },
    { slot: 2, name: 'Carlos Santos', relationship: 'spouse', dateOfBirth: '1983-07-22', annualIncome: 0 },
    { slot: 3, name: 'Ana Santos', relationship: 'child', dateOfBirth: '2010-01-05' },
    { slot: 4, name: 'Pedro Santos', relationship: 'child', dateOfBirth: '2013-06-18' },
    { slot: 5, name: 'Sofia Santos', relationship: 'child', dateOfBirth: '2018-09-30' },
  ]);
  await insertDocumentSlots(sub1Id, [
    { docType: 'paystubs', label: 'Paystubs (last 4)', status: 'missing', displayOrder: 10 },
    { docType: 'id_head', label: 'Photo ID — Head of Household', status: 'missing', displayOrder: 20 },
    { docType: 'id_spouse', label: 'Photo ID — Spouse/Partner', status: 'missing', displayOrder: 30 },
    { docType: 'birth_certificate_1', label: 'Birth Certificate — Ana Santos', status: 'missing', displayOrder: 40 },
    { docType: 'birth_certificate_2', label: 'Birth Certificate — Pedro Santos', status: 'missing', displayOrder: 50 },
    { docType: 'birth_certificate_3', label: 'Birth Certificate — Sofia Santos', status: 'missing', displayOrder: 60 },
    { docType: 'ss_card_head', label: 'Social Security Card — Head', status: 'missing', displayOrder: 70 },
  ]);
  console.log(`  ✓ App 1 created: ${app1Id}\n`);

  // ── App 2: James Okafor — Awaiting Response ───────────────────────────────
  console.log('Creating App 2: James Okafor (Awaiting Response)…');
  const sub2Id = await upsertFormSubmission({
    formType: 'pbv-full-application',
    tenantName: 'James Okafor',
    buildingAddress: '118 Wethersfield Avenue',
    unitNumber: '2B',
    formData: { test: true, seed: 'hach-portal' },
    submittedDaysAgo: 8,
  });
  const app2Id = await upsertFullApplication({
    formSubmissionId: sub2Id,
    headOfHouseholdName: 'James Okafor',
    buildingAddress: '118 Wethersfield Avenue',
    unitNumber: '2B',
    householdSize: 2,
    hachStatus: 'under_hach_review',
    createdDaysAgo: 8,
  });
  await insertHouseholdMembers(app2Id, [
    { slot: 1, name: 'James Okafor', relationship: 'head', dateOfBirth: '1979-11-02', annualIncome: 18000, incomeSources: ['ssi'], hasSsi: true },
    { slot: 2, name: 'Grace Okafor', relationship: 'spouse', dateOfBirth: '1981-04-15', annualIncome: 14400, incomeSources: ['employment'], employed: true },
  ]);
  const doc2Ids = await insertDocumentSlots(sub2Id, [
    { docType: 'ssi_award_letter', label: 'SSI Award Letter', status: 'approved', fileName: 'SSI_Award_Okafor.pdf', displayOrder: 10 },
    { docType: 'paystubs_grace', label: 'Paystubs — Grace Okafor', status: 'rejected', fileName: 'Paystubs_Okafor.pdf', displayOrder: 20 },
    { docType: 'id_head', label: 'Photo ID — James Okafor', status: 'submitted', fileName: 'ID_James_Okafor.pdf', displayOrder: 30 },
    { docType: 'id_spouse', label: 'Photo ID — Grace Okafor', status: 'missing', displayOrder: 40 },
  ]);
  await insertReviewActions(doc2Ids[0], app2Id, 'approved');
  await insertReviewActions(doc2Ids[1], app2Id, 'rejected', 'Paystubs are over 60 days old. Please resubmit current paystubs dated within the last 30 days.');
  await insertIncomeSources(app2Id, null, [
    { sourceType: 'ssi', frequency: 'monthly', amount: 1500 },
    { sourceType: 'employment', frequency: 'monthly', amount: 1200 },
  ]);
  console.log(`  ✓ App 2 created: ${app2Id}\n`);

  // ── App 3: Li Wei — Approved This Week ───────────────────────────────────
  console.log('Creating App 3: Li Wei (Approved This Week)…');
  const sub3Id = await upsertFormSubmission({
    formType: 'pbv-full-application',
    tenantName: 'Li Wei',
    buildingAddress: '88 Hungerford Drive',
    unitNumber: '5C',
    formData: { test: true, seed: 'hach-portal' },
    submittedDaysAgo: 12,
  });
  const app3Id = await upsertFullApplication({
    formSubmissionId: sub3Id,
    headOfHouseholdName: 'Li Wei',
    buildingAddress: '88 Hungerford Drive',
    unitNumber: '5C',
    householdSize: 1,
    hachStatus: 'approved_by_hach',
    stantonStatus: 'approved',
    createdDaysAgo: 12,
  });
  await insertHouseholdMembers(app3Id, [
    { slot: 1, name: 'Li Wei', relationship: 'head', dateOfBirth: '1990-08-07', annualIncome: 22000, incomeSources: ['employment'], employed: true },
  ]);
  const doc3Ids = await insertDocumentSlots(sub3Id, [
    { docType: 'paystubs', label: 'Paystubs (last 4)', status: 'approved', fileName: 'Paystubs_LiWei.pdf', displayOrder: 10 },
    { docType: 'id_head', label: 'Photo ID', status: 'approved', fileName: 'ID_LiWei.pdf', displayOrder: 20 },
    { docType: 'ss_card_head', label: 'Social Security Card', status: 'approved', fileName: 'SSCard_LiWei.pdf', displayOrder: 30 },
  ]);
  for (const docId of doc3Ids) {
    await insertReviewActions(docId, app3Id, 'approved');
  }
  await insertIncomeSources(app3Id, null, [
    { sourceType: 'employment', frequency: 'bi_weekly', amount: 846.15 },
  ]);
  console.log(`  ✓ App 3 created: ${app3Id}\n`);

  console.log('✅ HACH test seed complete.\n');
  console.log('Applications:');
  console.log(`  App 1 (Needs First Review): ${app1Id}`);
  console.log(`  App 2 (Awaiting Response):  ${app2Id}`);
  console.log(`  App 3 (Approved):           ${app3Id}`);
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
