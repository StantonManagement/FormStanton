/**
 * finalizeValidation.ts
 *
 * Shared validation logic for determining if a PBV full application is
 * ready to be finalized (submitted). Used by:
 * - GET /api/t/[token]/pbv-full-app (next_step computation)
 * - POST /api/t/[token]/pbv-full-app/finalize (completion validation)
 */

import { supabaseAdmin } from '@/lib/supabase';
import { sha256Hex } from '@/lib/pbv/form-generation/source-pdfs';

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
    result.missing.signatures.push({ signer_name: 'Applicant', doc_label: 'No household members added', doc_id: '' });
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
    .select('id, form_id, status, required_signer_member_ids, collected_signer_member_ids, unsigned_pdf_hash, unsigned_pdf_path')
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

  // 'no_longer_required' is the conditional-suppression status: a doc that was
  // seeded as required but the applicant's answers mean it isn't needed (e.g. an
  // SSI award letter for a wage-only household). recomputeApplicationDocSummary
  // already excludes it from the "missing" count; finalize must treat it the
  // same, or every application with any conditional suppression (≈ all of them)
  // can never finalize despite the tenant having nothing left to provide.
  const isCompleteStatus = (status: string): boolean =>
    status === 'submitted' ||
    status === 'approved' ||
    status === 'waived' ||
    status === 'no_longer_required';

  for (const doc of allDocs ?? []) {
    // Only check required documents, and only those that are missing or rejected
    if (doc.required && !isCompleteStatus(doc.status)) {
      result.missing.documents.push(doc.doc_type);
    }
  }

  // Check 5 (PRD-62): document_hash integrity. For each non-skipped form with a
  // cached unsigned_pdf_hash, every recorded signature event's document_hash
  // must match. Mismatch means the bytes drifted after signing — surface a
  // re-sign message. Null unsigned_pdf_hash (legacy pre-migration rows) is
  // skipped to avoid retroactively blocking packets generated before this PRD.
  for (const formDoc of (formDocs ?? [])) {
    if (!formDoc.unsigned_pdf_hash) continue;

    // #6: re-hash the CURRENT unsigned PDF bytes in storage and confirm they
    // still match the stored unsigned_pdf_hash. The event-vs-stored check
    // below catches a signer who signed *different* bytes; this catches the
    // case where the stored bytes themselves drifted from the recorded hash
    // (storage overwrite / corruption) without the hash column being updated.
    // Uses the same sha256Hex helper generate-forms used to write the hash,
    // so the comparison is format-consistent.
    if (formDoc.unsigned_pdf_path) {
      try {
        const { data: pdfBlob, error: dlErr } = await supabaseAdmin.storage
          .from('pbv-forms')
          .download(formDoc.unsigned_pdf_path);
        if (!dlErr && pdfBlob) {
          const liveHash = sha256Hex(Buffer.from(await pdfBlob.arrayBuffer()));
          if (liveHash !== formDoc.unsigned_pdf_hash) {
            result.missing.signatures.push({
              signer_name: 'Head of Household',
              doc_label: `${formDoc.form_id.replace(/_/g, ' ')} (document changed since signing — please regenerate and re-sign)`,
              doc_id: formDoc.id,
            });
          }
        }
        // A download failure is intentionally NOT a hard block: finalize must
        // not fail on a transient storage error. The event-vs-stored check
        // below still runs as the primary integrity gate.
      } catch (e) {
        console.error(`[finalize] live unsigned-PDF hash check failed for ${formDoc.id}:`, e);
      }
    }

    const { data: events } = await supabaseAdmin
      .from('pbv_signature_events')
      .select('document_hash, signer_member_id')
      .eq('form_document_id', formDoc.id);

    for (const ev of events ?? []) {
      if (ev.document_hash !== formDoc.unsigned_pdf_hash) {
        const member = memberMap.get(ev.signer_member_id);
        result.missing.signatures.push({
          signer_name: member?.name ?? 'Unknown',
          doc_label: `${formDoc.form_id} (signature/document hash mismatch — please re-sign)`,
          doc_id: formDoc.id,
        });
      }
    }
  }

  // Ready if nothing is missing
  result.ready =
    result.missing.documents.length === 0 && result.missing.signatures.length === 0;

  return result;
}
