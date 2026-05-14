/**
 * seedFromTemplates.ts
 *
 * Seeding primitives for document slots from form_document_templates.
 *
 * seedDocumentsForApplication — writes to application_documents.
 *   Used by PBV (anchor_type='pbv_full_application') and any future
 *   multi-step workflow. Idempotent: skips slots that already exist
 *   for the given (anchor_type, anchor_id, doc_type, person_slot, revision=0).
 *
 * seedDocumentsForSubmission — writes to form_submission_documents.
 *   Used by simple one-shot tenant forms (move-out notice, pet approval, etc.).
 *   Unchanged from the existing inline logic in the submissions POST route.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { getApplicableMembers, type HouseholdMember } from '@/lib/memberFilter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeedDocumentsForApplicationParams {
  formId: string;
  anchorType: string;
  anchorId: string;
  householdMembers: HouseholdMember[];
}

export interface SeedDocumentsForSubmissionParams {
  formId: string;
  submissionId: string;
  householdMembers: HouseholdMember[];
}

export interface SeedResult {
  inserted: number;
  perTemplate: Record<string, number>;
}

// ---------------------------------------------------------------------------
// seedDocumentsForApplication
// ---------------------------------------------------------------------------

export async function seedDocumentsForApplication(
  params: SeedDocumentsForApplicationParams
): Promise<SeedResult> {
  const { formId, anchorType, anchorId, householdMembers } = params;

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('form_document_templates')
    .select('*')
    .eq('form_id', formId)
    .order('display_order', { ascending: true });

  if (templatesError) {
    throw new Error(`[seedDocumentsForApplication] Failed to fetch templates: ${templatesError.message}`);
  }
  if (!templates || templates.length === 0) {
    throw new Error(`[seedDocumentsForApplication] No templates found for form_id '${formId}'`);
  }

  // Fetch existing slots to enforce idempotency
  const { data: existing } = await supabaseAdmin
    .from('application_documents')
    .select('doc_type, person_slot')
    .eq('anchor_type', anchorType)
    .eq('anchor_id', anchorId)
    .eq('revision', 0);

  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.doc_type}:${r.person_slot}`)
  );

  const rows: object[] = [];
  const perTemplate: Record<string, number> = {};

  for (const template of templates) {
    // Check conditional_on: skip if condition defined and not yet evaluatable at seeding time
    // (conditional evaluation is form-data-dependent; at admin seed time we seed all)
    const slotsForTemplate = buildSlotsForTemplate(template, householdMembers);

    for (const slot of slotsForTemplate) {
      const key = `${template.doc_type}:${slot}`;
      if (existingKeys.has(key)) {
        continue;
      }

      rows.push({
        anchor_type: anchorType,
        anchor_id: anchorId,
        doc_type: template.doc_type,
        label: template.label,
        required: template.required,
        display_order: template.display_order,
        person_slot: slot,
        revision: 0,
        status: 'missing',
        requires_signature: template.requires_signature === true,
        signer_scope: template.signer_scope ?? null,
        created_by: 'system',
      });

      perTemplate[template.doc_type] = (perTemplate[template.doc_type] ?? 0) + 1;
    }
  }

  if (rows.length === 0) {
    return { inserted: 0, perTemplate };
  }

  const { error: insertError } = await supabaseAdmin
    .from('application_documents')
    .insert(rows);

  if (insertError) {
    throw new Error(`[seedDocumentsForApplication] Insert failed: ${insertError.message}`);
  }

  return { inserted: rows.length, perTemplate };
}

// ---------------------------------------------------------------------------
// seedDocumentsForSubmission (non-PBV forms — unchanged substrate)
// ---------------------------------------------------------------------------

export async function seedDocumentsForSubmission(
  params: SeedDocumentsForSubmissionParams
): Promise<SeedResult> {
  const { formId, submissionId, householdMembers } = params;

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('form_document_templates')
    .select('*')
    .eq('form_id', formId)
    .order('display_order', { ascending: true });

  if (templatesError) {
    throw new Error(`[seedDocumentsForSubmission] Failed to fetch templates: ${templatesError.message}`);
  }
  if (!templates || templates.length === 0) {
    throw new Error(`[seedDocumentsForSubmission] No templates found for form_id '${formId}'`);
  }

  // Idempotency: skip slots that already exist
  const { data: existing } = await supabaseAdmin
    .from('form_submission_documents')
    .select('doc_type, person_slot')
    .eq('form_submission_id', submissionId)
    .eq('revision', 0);

  const existingKeys = new Set(
    (existing ?? []).map((r) => `${r.doc_type}:${r.person_slot}`)
  );

  const rows: object[] = [];
  const perTemplate: Record<string, number> = {};

  for (const template of templates) {
    const slotsForTemplate = buildSlotsForTemplate(template, householdMembers);

    for (const slot of slotsForTemplate) {
      const key = `${template.doc_type}:${slot}`;
      if (existingKeys.has(key)) {
        continue;
      }

      rows.push({
        form_submission_id: submissionId,
        doc_type: template.doc_type,
        label: template.label,
        required: template.required,
        display_order: template.display_order,
        person_slot: slot,
        revision: 0,
        status: 'missing',
        requires_signature: template.requires_signature === true,
        signer_scope: template.signer_scope ?? null,
        created_by: 'system',
      });

      perTemplate[template.doc_type] = (perTemplate[template.doc_type] ?? 0) + 1;
    }
  }

  if (rows.length === 0) {
    return { inserted: 0, perTemplate };
  }

  const { error: insertError } = await supabaseAdmin
    .from('form_submission_documents')
    .insert(rows);

  if (insertError) {
    throw new Error(`[seedDocumentsForSubmission] Insert failed: ${insertError.message}`);
  }

  return { inserted: rows.length, perTemplate };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildSlotsForTemplate(
  template: {
    per_person: boolean;
    applies_to: string;
    member_filter: unknown;
  },
  householdMembers: HouseholdMember[]
): number[] {
  if (!template.per_person || template.applies_to === 'submission') {
    return [0];
  }

  const members = getApplicableMembers(
    householdMembers,
    template.applies_to,
    template.member_filter
  );

  if (members.length === 0) {
    return [0];
  }

  return members.map((m) => m.slot);
}
