/**
 * finalizeValidation.ts
 *
 * Shared validation logic for determining if a PBV full application is
 * ready to be finalized (submitted). Used by:
 * - GET /api/t/[token]/pbv-full-app (next_step computation)
 * - POST /api/t/[token]/pbv-full-app/finalize (completion validation)
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface MissingSignature {
  signer_name: string;
  doc_label: string;
  doc_id: string;
}

export interface FinalizeValidationResult {
  ready: boolean;
  missing: {
    documents: string[]; // doc_type values still missing
    signatures: MissingSignature[]; // per-doc, per-signer attribution
  };
}

/**
 * Validates whether a PBV full application is ready to be finalized.
 *
 * Checks:
 * 1. Intake is submitted (household members exist)
 * 2. All required signatures are complete
 * 3. All required documents are submitted/approved/waived (none missing/rejected)
 *
 * @param applicationId - The UUID of the pbv_full_applications row
 * @returns FinalizeValidationResult with ready flag and missing items
 */
export async function validateReadyToFinalize(
  applicationId: string
): Promise<FinalizeValidationResult> {
  const result: FinalizeValidationResult = {
    ready: false,
    missing: {
      documents: [],
      signatures: [],
    },
  };

  // Check 1: Intake submitted (household members exist)
  const { count: memberCount } = await supabaseAdmin
    .from('pbv_household_members')
    .select('id', { count: 'exact', head: true })
    .eq('full_application_id', applicationId);

  const intakeSubmitted = (memberCount ?? 0) > 0;
  if (!intakeSubmitted) {
    result.missing.signatures.push({ signer_name: 'Applicant', doc_label: 'Application intake not completed', doc_id: '' });
    return result;
  }

  // Check 2: All required signatures are complete
  const { data: sigMembers } = await supabaseAdmin
    .from('pbv_household_members')
    .select('id, slot, name, signature_required')
    .eq('full_application_id', applicationId)
    .eq('signature_required', true);

  const { data: signatureDocs } = await supabaseAdmin
    .from('application_documents')
    .select('id, label, person_slot, signer_scope, status, requires_signature')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId)
    .eq('requires_signature', true);

  const isSignedStatus = (status: string): boolean =>
    status === 'submitted' || status === 'approved' || status === 'waived';

  const docsForMember = (slot: number) =>
    (signatureDocs ?? []).filter((doc) => {
      if (doc.signer_scope === 'all_adults') {
        return doc.person_slot === slot;
      }
      if (doc.signer_scope === 'hoh_only') {
        return slot === 1 && doc.person_slot === 0;
      }
      if (doc.signer_scope === 'individual') {
        return doc.person_slot === slot || (slot === 1 && doc.person_slot === 0);
      }
      return doc.person_slot === slot;
    });

  if (sigMembers && sigMembers.length > 0) {
    for (const member of sigMembers) {
      const requiredDocs = docsForMember(member.slot);
      for (const doc of requiredDocs) {
        if (!isSignedStatus(doc.status)) {
          result.missing.signatures.push({
            signer_name: member.name,
            doc_label: doc.label ?? doc.id,
            doc_id: doc.id,
          });
        }
      }
    }
  }

  // Check 3: All required documents are submitted/approved/waived
  const { data: allDocs } = await supabaseAdmin
    .from('application_documents')
    .select('doc_type, label, status, required')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId);

  const isCompleteStatus = (status: string): boolean =>
    status === 'submitted' || status === 'approved' || status === 'waived';

  for (const doc of allDocs ?? []) {
    // Only check required documents, and only those that are missing or rejected
    if (doc.required && !isCompleteStatus(doc.status)) {
      result.missing.documents.push(doc.doc_type);
    }
  }

  // Ready if nothing is missing
  result.ready =
    result.missing.documents.length === 0 && result.missing.signatures.length === 0;

  return result;
}
