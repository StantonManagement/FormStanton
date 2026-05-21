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
 * 2. Summary document is signed (F1: canonical model)
 * 3. All form documents are signed (F1: pbv_form_documents collected ⊇ required)
 * 4. All required documents are submitted/approved/waived (none missing/rejected)
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

  // Check 2: Summary document must be signed
  const { data: summaryDoc } = await supabaseAdmin
    .from('pbv_summary_documents')
    .select('id, signed_at')
    .eq('full_application_id', applicationId)
    .maybeSingle();

  if (!summaryDoc?.signed_at) {
    result.missing.signatures.push({
      signer_name: 'Head of Household',
      doc_label: 'Summary document not signed',
      doc_id: summaryDoc?.id ?? 'summary',
    });
  }

  // Check 3: All form documents must be signed (F1: use canonical pbv_form_documents model)
  // Load form documents and members
  const { data: formDocs } = await supabaseAdmin
    .from('pbv_form_documents')
    .select('id, form_id, status, required_signer_member_ids, collected_signer_member_ids')
    .eq('full_application_id', applicationId)
    .not('status', 'eq', 'skipped'); // Skip forms that are conditionally excluded

  const { data: members } = await supabaseAdmin
    .from('pbv_household_members')
    .select('id, name, slot')
    .eq('full_application_id', applicationId);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m]));

  for (const formDoc of (formDocs ?? [])) {
    const requiredIds: string[] = formDoc.required_signer_member_ids ?? [];
    const collectedIds: string[] = formDoc.collected_signer_member_ids ?? [];

    // Check if all required signers have signed
    const allCollected = requiredIds.every((id) => collectedIds.includes(id));
    const isSigned = formDoc.status === 'signed' || formDoc.status === 'finalized' || allCollected;

    if (!isSigned) {
      // Find missing signers
      for (const memberId of requiredIds) {
        if (!collectedIds.includes(memberId)) {
          const member = memberMap.get(memberId);
          result.missing.signatures.push({
            signer_name: member?.name ?? 'Unknown',
            doc_label: formDoc.form_id.replace(/_/g, ' '),
            doc_id: formDoc.id,
          });
        }
      }
    }
  }

  // Check 4: All required documents are submitted/approved/waived
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
