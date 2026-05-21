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

export interface CompleteFormResult {
  success: boolean;
  alreadySigned: boolean;
  allSigned: boolean;
  status: string;
  signedPdfPath?: string | null;
  error?: string;
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
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: formDocError.message };
  }
  if (!formDoc) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Form document not found' };
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
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Signer not required for this form' };
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
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Member not found' };
  }

  // ── Download unsigned PDF ──────────────────────────────────────────────────
  if (!formDoc.unsigned_pdf_path) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Unsigned PDF not available' };
  }

  const { data: pdfDownload, error: pdfError } = await supabaseAdmin.storage
    .from('pbv-forms')
    .download(formDoc.unsigned_pdf_path);

  if (pdfError || !pdfDownload) {
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: pdfError?.message ?? 'Failed to download unsigned PDF' };
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
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: eventError.message };
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
      return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: 'Field map not found' };
    }

    // Load all signature events for this form
    const { data: allSigEvents, error: sigEventsError } = await supabaseAdmin
      .from('pbv_signature_events')
      .select('signer_member_id, signature_image_path')
      .eq('form_document_id', formDoc.id);

    if (sigEventsError) {
      return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: sigEventsError.message };
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
    return { success: false, alreadySigned: false, allSigned: false, status: 'error', error: docUpdateError.message };
  }

  // ── Update member signing_device ──────────────────────────────────────────
  await supabaseAdmin
    .from('pbv_household_members')
    .update({ signing_device: deviceOwner })
    .eq('id', signerMemberId);

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

async function loadFieldMapForSigning(formId: string, language: 'en' | 'es'): Promise<FieldMap | null> {
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

function buildSignatureFieldData(
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
