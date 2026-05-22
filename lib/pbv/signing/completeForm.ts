/**
 * lib/pbv/signing/completeForm.ts
 *
 * Shared completion logic for form signing, used by:
 * - HOH sign-form route (same-device)
 * - Member-token sign-form route (magic-link)
 *
 * Handles: updating collected signers, stamping signed PDF when all signers complete,
 * setting form status, and rolling up signing_status on the application.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { stampForm } from '@/lib/pbv/form-generation/stamper';
import type { FieldMap } from '@/lib/pbv/form-generation/stamper';
import { createHash } from 'crypto';

export interface CompleteFormOptions {
  formDocId: string;
  appId: string;
  signerMemberId: string;
  deviceOwner: 'self' | 'hoh_device' | 'staff_assisted';
  signatureImagePath: string;
  ceremonyId: string;
  consentTextVersion: string;
  typedName: string;
  assistedByStaffUserId?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * PRD-82 #A12: typed error codes for the structural failure branches.
 * Added alongside the existing `error` string (additive — every existing
 * caller keeps working unchanged). The member-token sign-form route uses
 * `errorCode === 'not_found'` to map status to 404 vs 422 instead of
 * brittle case-sensitive substring matching on the error string.
 */
export type CompleteFormErrorCode =
  | 'not_found'                    // form document row missing for (id, app)
  | 'load_error'                   // DB error loading the form doc
  | 'signer_not_required'          // member is not in required_signer_member_ids
  | 'member_not_found'             // signer member row missing for (id, app)
  | 'unsigned_pdf_missing'         // form doc has no unsigned_pdf_path
  | 'unsigned_pdf_download_error'  // storage failed to return the unsigned PDF
  | 'event_insert_error'           // failed to write pbv_signature_events row
  | 'field_map_missing'            // signed-PDF stamp could not locate field map
  | 'sig_events_load_error'        // failed to load sibling signature events
  | 'signed_pdf_upload_error'      // signed-PDF upload to storage failed (non-benign)
  | 'doc_update_error';            // final pbv_form_documents UPDATE failed

export interface CompleteFormResult {
  success: boolean;
  alreadySigned: boolean;
  allSigned: boolean;
  status: string;
  signedPdfPath?: string | null;
  /** Human-readable error message — preserved for existing callers. */
  error?: string;
  /** PRD-82 #A12: typed error code; callers map to HTTP status via this. */
  errorCode?: CompleteFormErrorCode;
}

/**
 * Complete a form signing: update collected signers, stamp PDF if all signers complete,
 * and roll up signing status.
 */
export async function completeFormSigning(
  options: CompleteFormOptions
): Promise<CompleteFormResult> {
  const {
    formDocId,
    appId,
    signerMemberId,
    deviceOwner,
    signatureImagePath,
    ceremonyId,
    consentTextVersion,
    typedName,
    assistedByStaffUserId,
    ipAddress,
    userAgent,
  } = options;

  // ── Load form document ───────────────────────────────────────────────────
  const { data: formDoc, error: formDocError } = await supabaseAdmin
    .from('pbv_form_documents')
    .select('id, full_application_id, form_id, language, status, unsigned_pdf_path, required_signer_member_ids, collected_signer_member_ids, signed_pdf_path')
    .eq('id', formDocId)
    .eq('full_application_id', appId)
    .maybeSingle();

  if (formDocError) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: formDocError.message, errorCode: 'load_error' };
  }
  if (!formDoc) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Form document not found', errorCode: 'not_found' };
  }

  // Already fully signed?
  if (formDoc.status === 'signed' || formDoc.status === 'finalized') {
    return {
      success: true,
      alreadySigned: true,
      allSigned: true,
      status: formDoc.status,
      signedPdfPath: formDoc.signed_pdf_path,
    };
  }

  // ── Validate signer is required ─────────────────────────────────────────
  const requiredIds: string[] = formDoc.required_signer_member_ids ?? [];
  if (!requiredIds.includes(signerMemberId)) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Signer not required for this form', errorCode: 'signer_not_required' };
  }

  // ── Idempotent: already collected? ────────────────────────────────────────
  const collected: string[] = formDoc.collected_signer_member_ids ?? [];
  if (collected.includes(signerMemberId)) {
    return {
      success: true,
      alreadySigned: true,
      allSigned: requiredIds.every((id) => collected.includes(id)),
      status: formDoc.status,
      signedPdfPath: formDoc.signed_pdf_path,
    };
  }

  // ── Get member info ───────────────────────────────────────────────────────
  const { data: member } = await supabaseAdmin
    .from('pbv_household_members')
    .select('id, name, slot')
    .eq('id', signerMemberId)
    .eq('full_application_id', appId)
    .maybeSingle();

  if (!member) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Member not found', errorCode: 'member_not_found' };
  }

  // ── Download unsigned PDF ──────────────────────────────────────────────────
  if (!formDoc.unsigned_pdf_path) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Unsigned PDF not available', errorCode: 'unsigned_pdf_missing' };
  }

  const { data: pdfDownload, error: pdfError } = await supabaseAdmin.storage
    .from('pbv-forms')
    .download(formDoc.unsigned_pdf_path);

  if (pdfError || !pdfDownload) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: pdfError?.message ?? 'Failed to download unsigned PDF', errorCode: 'unsigned_pdf_download_error' };
  }

  const unsignedPdfBytes = Buffer.from(await pdfDownload.arrayBuffer());

  // ── Compute document hash ───────────────────────────────────────────────────
  const documentHash = createHash('sha256').update(unsignedPdfBytes).digest('hex');

  // ── Insert signature event ──────────────────────────────────────────────────
  const { error: eventError } = await supabaseAdmin
    .from('pbv_signature_events')
    .insert({
      form_document_id: formDoc.id,
      signer_member_id: signerMemberId,
      signature_image_path: signatureImagePath,
      typed_name: typedName,
      signed_at: new Date().toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      device_owner: deviceOwner,
      document_hash: documentHash,
      ceremony_id: ceremonyId,
      consent_text_version: consentTextVersion,
      assisted_by_staff_user_id: assistedByStaffUserId ?? null,
    });

  if (eventError) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: eventError.message, errorCode: 'event_insert_error' };
  }

  // ── Update collected signers ─────────────────────────────────────────────
  const updatedCollected = [...collected, signerMemberId];
  const allSigned = requiredIds.every((id) => updatedCollected.includes(id));

  const formDocUpdate: Record<string, unknown> = {
    collected_signer_member_ids: updatedCollected,
  };

  let signedPdfPath: string | null = null;

  // ── If all signers complete, stamp signature onto final PDF ────────────────
  if (allSigned) {
    // Load field map
    const fieldMap = await loadFieldMapForSigning(formDoc.form_id, formDoc.language as 'en' | 'es');

    if (!fieldMap) {
      return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Field map not found', errorCode: 'field_map_missing' };
    }

    // Load all signature events for this form
    const { data: allSigEvents, error: sigEventsError } = await supabaseAdmin
      .from('pbv_signature_events')
      .select('signer_member_id, signature_image_path')
      .eq('form_document_id', formDoc.id);

    if (sigEventsError) {
      return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: sigEventsError.message, errorCode: 'sig_events_load_error' };
    }

    // Build signature image map
    const sigImageMap = new Map<string, Buffer>();
    for (const ev of (allSigEvents ?? [])) {
      if (!ev.signature_image_path) continue;
      const { data: imgData, error: imgError } = await supabaseAdmin.storage
        .from('pbv-signatures')
        .download(ev.signature_image_path);
      if (!imgError && imgData) {
        sigImageMap.set(ev.signer_member_id, Buffer.from(await imgData.arrayBuffer()));
      }
    }

    // Load member slots
    const { data: membersData } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot')
      .eq('full_application_id', appId)
      .in('id', requiredIds);

    const memberSlotMap = new Map<string, number>();
    for (const m of (membersData ?? [])) {
      memberSlotMap.set(m.id, m.slot);
    }

    // Build signature field data
    const signatureFieldData = buildSignatureFieldData(
      fieldMap,
      requiredIds,
      memberSlotMap
    );

    // Download first signature image for legacy fallback
    const firstSigPath = signatureImagePath;
    const { data: firstSigData } = await supabaseAdmin.storage
      .from('pbv-signatures')
      .download(firstSigPath);
    const firstSigBytes = firstSigData ? Buffer.from(await firstSigData.arrayBuffer()) : null;

    const signedPdfBuffer = await stampForm({
      fieldMap,
      data: signatureFieldData,
      sourcePdfBytes: unsignedPdfBytes,
      imageResolver: async (path: string) => {
        if (path.startsWith('__sig__:')) {
          const memberId = path.slice('__sig__:'.length);
          return sigImageMap.get(memberId) ?? null;
        }
        if (path === '__sig__') return firstSigBytes;
        return null;
      },
    });

    // PRD-66 (audit #11): suffix the signed-PDF path with the ceremony_id so a
    // restarted ceremony writes a NEW object and the prior signed artifact is
    // retained for audit. Upload with upsert:false so a different-ceremony
    // collision (impossible by construction) would fail loudly; a true
    // same-ceremony replay just re-points signed_pdf_path at the existing
    // object without throwing.
    signedPdfPath = `pbv/${appId}/forms/${formDoc.form_id}-${formDoc.language}-${ceremonyId}-signed.pdf`;

    const { error: signedUploadError } = await supabaseAdmin.storage
      .from('pbv-forms')
      .upload(signedPdfPath, signedPdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (signedUploadError) {
      // The Supabase Storage SDK surfaces an "already exists" failure with
      // statusCode '409' or a message containing "exists" / "already exists"
      // / "duplicate". For the same ceremony_id this means an idempotent
      // replay landed at the same path; treat it as already-written.
      const msg = String(signedUploadError.message ?? '').toLowerCase();
      const status = String((signedUploadError as any).statusCode ?? '');
      const benignReplay = status === '409' || msg.includes('exist') || msg.includes('duplicate');

      if (!benignReplay) {
        return {
          success: false,
          alreadySigned: false,
          allSigned: false,
          status: 'error',
          error: signedUploadError.message,
          errorCode: 'signed_pdf_upload_error',
        };
      }
      // Fall through: signedPdfPath already points at the existing object.
    }

    formDocUpdate.status = 'signed';
    formDocUpdate.signed_pdf_path = signedPdfPath;
    formDocUpdate.finalized_at = new Date().toISOString();
  }

  // Update form doc
  const { error: docUpdateError } = await supabaseAdmin
    .from('pbv_form_documents')
    .update(formDocUpdate)
    .eq('id', formDoc.id);

  if (docUpdateError) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: docUpdateError.message, errorCode: 'doc_update_error' };
  }

  // ── Update member signing_device ──────────────────────────────────────────
  await supabaseAdmin
    .from('pbv_household_members')
    .update({ signing_device: deviceOwner })
    .eq('id', signerMemberId);

  // ── PRP-023: dual-write application_documents (signed_forms) ──────────────
  // Finalize Check 4 reads application_documents.status. The new pbv_form_documents
  // signing flow does not touch application_documents, so signed_forms-category
  // rows stayed 'missing' forever and finalize never went green. Mark them
  // submitted here so Check 3 (form docs) and Check 4 (application docs) agree.
  //
  // Mapping:
  //  - HOH-scope (submission_level / head_of_household_only): when the form
  //    is fully signed, mark every matching signed_forms row (any person_slot).
  //  - Per-person scope (each_adult / individual / each_member): mark only
  //    the row for the slot of the member who just signed.
  //  - PRD-55 alias: pbv_form_documents.form_id='briefing_cert' maps to
  //    application_documents.doc_type='briefing_docs_certification' as well.
  await syncApplicationDocumentsForSignedForm({
    appId,
    formId: formDoc.form_id,
    signerMemberId,
    signerSlot: member.slot,
    allSigned,
  });

  // ── Check if all forms signed — update signing_status ────────────────────
  await updateApplicationSigningStatus(appId);

  return {
    success: true,
    alreadySigned: false,
    allSigned,
    status: allSigned ? 'signed' : formDoc.status,
    signedPdfPath,
  };
}

/**
 * Update the application's signing_status based on form completion.
 */
export async function updateApplicationSigningStatus(appId: string): Promise<void> {
  const { data: allDocs } = await supabaseAdmin
    .from('pbv_form_documents')
    .select('status')
    .eq('full_application_id', appId);

  const allFormsComplete = (allDocs ?? []).every(
    (d) => d.status === 'signed' || d.status === 'finalized' || d.status === 'skipped'
  );

  if (allFormsComplete && (allDocs ?? []).length > 0) {
    await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        signing_status: 'complete',
        signing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appId);
  } else {
    await supabaseAdmin
      .from('pbv_full_applications')
      .update({ signing_status: 'in_progress', updated_at: new Date().toISOString() })
      .eq('id', appId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * PRP-023: map a pbv_form_documents.form_id to the doc_type(s) that the
 * matching signed_forms-category application_documents rows use.
 *
 * One special case today: PRD-55 renamed `briefing_docs_certification` to
 * `briefing_cert` inside pbv_form_templates / pbv_form_documents only.
 * form_document_templates (and therefore application_documents.doc_type)
 * was never updated, so a fully-signed briefing_cert form has to look up
 * the OLD doc_type to find its application_documents row.
 *
 * Exported so a regression test can lock the mapping in place.
 */
export function formIdToDocTypes(formId: string): string[] {
  if (formId === 'briefing_cert') return ['briefing_cert', 'briefing_docs_certification'];
  return [formId];
}

/**
 * PRP-023: dual-write application_documents (signed_forms category) when a
 * pbv_form_documents row gains a signer. See call site in completeFormSigning
 * for the rules — summary: HOH-scope marks every matching slot, per-person
 * scope marks only the slot of the signer who just signed.
 *
 * Non-fatal: a sync failure logs but does not abort the signing flow. The
 * finalize migration backfill can repair stragglers.
 */
async function syncApplicationDocumentsForSignedForm(opts: {
  appId: string;
  formId: string;
  signerMemberId: string;
  signerSlot: number;
  allSigned: boolean;
}): Promise<void> {
  const { appId, formId, signerSlot, allSigned } = opts;
  try {
    // Look up the template's per_person_scope to decide the update shape.
    const { data: template } = await supabaseAdmin
      .from('pbv_form_templates')
      .select('per_person_scope')
      .eq('form_id', formId)
      .maybeSingle();

    const scope = (template?.per_person_scope ?? null) as string | null;
    const docTypes = formIdToDocTypes(formId);
    const nowIso = new Date().toISOString();

    if (scope === 'submission_level' || scope === 'head_of_household_only') {
      // HOH signs once for the family. Only flip rows when the form has
      // reached all required signers (= the single HOH signature here).
      if (!allSigned) return;
      const { error } = await supabaseAdmin
        .from('application_documents')
        .update({ status: 'submitted', updated_at: nowIso })
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', appId)
        .in('doc_type', docTypes)
        .eq('category', 'signed_forms')
        .eq('status', 'missing');
      if (error) {
        console.error('[completeForm] syncApplicationDocuments (HOH) failed:', error);
      }
      return;
    }

    if (scope === 'each_adult' || scope === 'individual' || scope === 'each_member') {
      // Per-person: each signer marks their own row.
      const { error } = await supabaseAdmin
        .from('application_documents')
        .update({ status: 'submitted', updated_at: nowIso })
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', appId)
        .in('doc_type', docTypes)
        .eq('category', 'signed_forms')
        .eq('person_slot', signerSlot)
        .eq('status', 'missing');
      if (error) {
        console.error('[completeForm] syncApplicationDocuments (per-person) failed:', error);
      }
      return;
    }

    // Unknown scope or no template row found: log + skip (fail open, the
    // migration backfill will mop up).
    console.warn(
      `[completeForm] No matching pbv_form_templates row or unknown scope for form_id=${formId}; ` +
        `application_documents will be backfilled on finalize migration apply.`
    );
  } catch (e) {
    console.error('[completeForm] syncApplicationDocuments threw:', e);
  }
}

// PRP-005 / #8: exported for the regression test that asserts a missing
// field map cannot advance form_doc.status to 'signed'.
export async function loadFieldMapForSigning(formId: string, language: 'en' | 'es'): Promise<FieldMap | null> {
  const { readFileSync, existsSync } = require('fs');
  const { join } = require('path');
  const slug = formId.replace(/_/g, '-');
  const path = join(process.cwd(), 'scripts', 'field-maps', `${slug}-${language}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as FieldMap;
  } catch {
    return null;
  }
}

// PRP-005 / #5: exported for the regression test that asserts each adult
// row gets its own `__sig__:${memberId}` marker (not a shared buffer).
export function buildSignatureFieldData(
  fieldMap: FieldMap,
  requiredSignerIds: string[],
  memberSlotMap: Map<string, number>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Search flat fields for signature images
  const sigField = fieldMap.fields.find(
    (f) => f.type === 'image' && f.name.includes('signature')
  );
  if (sigField) {
    result[sigField.name] = `__sig__:${requiredSignerIds[0]}`;
  }

  // Search row_patterns for signature images
  const rowPatterns = fieldMap.row_patterns ?? (fieldMap.row_pattern ? [fieldMap.row_pattern] : []);
  for (const pattern of rowPatterns) {
    for (const col of pattern.columns) {
      const key = col.member_key ?? col.field_prefix ?? '';
      if (col.type === 'image' && key.includes('signature')) {
        for (const memberId of requiredSignerIds) {
          const slot = memberSlotMap.get(memberId) ?? 1;
          const rowIndex = slot - 1;
          result[`__row_pattern:${pattern.data_key}:signature:${rowIndex}`] = `__sig__:${memberId}`;
        }
      }
    }
  }

  return result;
}
