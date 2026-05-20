/**
 * POST /api/t/[token]/pbv-full-app/sign-form
 *
 * Per-form tap-to-confirm. Creates one pbv_signature_events row per (signer × form).
 * Gates: summary doc must be signed before any federal form can be signed.
 *
 * Body:
 *   - form_document_id: string       — UUID from pbv_form_documents
 *   - signer_member_id: string       — UUID of the household member signing
 *   - typed_name: string             — identity confirmation
 *   - signature_image_path: string   — storage path from signature/capture
 *   - ceremony_id: string            — UUID grouping all per-form taps in one ceremony
 *   - consent_text_version: string
 *   - device_owner: 'self' | 'hoh_device' | 'staff_assisted' (default: 'self')
 *
 * After each signature event, updates collected_signer_member_ids on the form document.
 * When all required signers have signed: stamps the signed PDF, uploads it, sets status='signed'.
 * When all forms are signed: sets signing_status='complete' on pbv_full_applications.
 *
 * Idempotent via Idempotency-Key header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { stampForm } from '@/lib/pbv/form-generation/stamper';
import type { FieldMap } from '@/lib/pbv/form-generation/stamper';
import { createHash } from 'crypto';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'sign-form', async (app) => {
    const body = await request.json().catch(() => null);

    if (!body?.form_document_id || !body?.signer_member_id || !body?.typed_name ||
        !body?.signature_image_path || !body?.ceremony_id) {
      return {
        body: {
          success: false,
          message: 'form_document_id, signer_member_id, typed_name, signature_image_path, and ceremony_id are required',
        },
        status: 400,
      };
    }

    const {
      form_document_id,
      signer_member_id,
      typed_name,
      signature_image_path,
      ceremony_id,
      consent_text_version = '2026-05-15-v1',
      device_owner = 'self',
    } = body;

    // Read X-Assisted-By header — set by tenantFetch when session carries assistedMode.
    // Validate that this staff user exists in admin_users before trusting it.
    const assistedByHeader = request.headers.get('X-Assisted-By');
    let assistedByStaffUserId: string | null = null;
    if (assistedByHeader) {
      const { data: staffRow } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('id', assistedByHeader)
        .maybeSingle();
      if (staffRow) assistedByStaffUserId = staffRow.id;
    }

    // ── Load form document ───────────────────────────────────────────────────
    const { data: formDoc, error: formDocError } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, full_application_id, form_id, language, status, unsigned_pdf_path, required_signer_member_ids, collected_signer_member_ids')
      .eq('id', form_document_id)
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (formDocError) throw formDocError;
    if (!formDoc) {
      return { body: { success: false, message: 'Form document not found' }, status: 404 };
    }

    if (formDoc.status === 'signed' || formDoc.status === 'finalized') {
      return {
        body: { success: true, data: { already_signed: true, status: formDoc.status } },
        status: 200,
      };
    }

    // ── Gate: summary doc must be signed ────────────────────────────────────
    const { data: summary } = await supabaseAdmin
      .from('pbv_summary_documents')
      .select('signed_at')
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (!summary?.signed_at) {
      return {
        body: {
          success: false,
          message: 'Summary document must be signed before signing federal forms',
          code: 'summary_not_signed',
        },
        status: 422,
      };
    }

    // ── Validate signer is required for this form ────────────────────────────
    const requiredIds: string[] = formDoc.required_signer_member_ids ?? [];
    if (!requiredIds.includes(signer_member_id)) {
      return {
        body: {
          success: false,
          message: 'This signer is not required for this form',
          code: 'signer_not_required',
        },
        status: 403,
      };
    }

    // ── Idempotent: already signed this form? ────────────────────────────────
    const collected: string[] = formDoc.collected_signer_member_ids ?? [];
    if (collected.includes(signer_member_id)) {
      return {
        body: { success: true, data: { already_signed: true, status: formDoc.status } },
        status: 200,
      };
    }

    // ── Verify member belongs to this application ─────────────────────────────
    const { data: member, error: memberError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, name')
      .eq('id', signer_member_id)
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      return { body: { success: false, message: 'Signer member not found' }, status: 404 };
    }

    // ── Download unsigned PDF ────────────────────────────────────────────────
    if (!formDoc.unsigned_pdf_path) {
      return {
        body: { success: false, message: 'Unsigned PDF not available for this form' },
        status: 422,
      };
    }

    const { data: pdfDownload, error: pdfError } = await supabaseAdmin.storage
      .from('pbv-forms')
      .download(formDoc.unsigned_pdf_path);

    if (pdfError || !pdfDownload) {
      throw pdfError ?? new Error('Failed to download unsigned PDF');
    }

    const unsignedPdfBytes = Buffer.from(await pdfDownload.arrayBuffer());

    // ── Compute document hash (what signer sees) ──────────────────────────────
    const documentHash = createHash('sha256').update(unsignedPdfBytes).digest('hex');

    // ── Download signature image ─────────────────────────────────────────────
    const { data: sigImageDownload, error: sigError } = await supabaseAdmin.storage
      .from('pbv-signatures')
      .download(signature_image_path);

    if (sigError || !sigImageDownload) {
      throw sigError ?? new Error('Failed to download signature image');
    }

    const sigImageBytes = Buffer.from(await sigImageDownload.arrayBuffer());

    // ── Insert signature event ───────────────────────────────────────────────
    const { error: eventError } = await supabaseAdmin
      .from('pbv_signature_events')
      .insert({
        form_document_id: formDoc.id,
        signer_member_id,
        signature_image_path,
        typed_name,
        signed_at: new Date().toISOString(),
        ip_address: request.headers.get('x-forwarded-for') ?? null,
        user_agent: request.headers.get('user-agent') ?? null,
        device_owner,
        document_hash: documentHash,
        ceremony_id,
        consent_text_version,
        assisted_by_staff_user_id: assistedByStaffUserId,
      });

    if (eventError) throw eventError;

    // ── Update collected signers ─────────────────────────────────────────────
    const updatedCollected = [...collected, signer_member_id];
    const allSigned = requiredIds.every((id) => updatedCollected.includes(id));

    const formDocUpdate: Record<string, unknown> = {
      collected_signer_member_ids: updatedCollected,
    };

    let signedPdfPath: string | null = null;

    // ── If all signers complete, stamp signature onto final PDF ───────────────
    if (allSigned) {
      // Load field map for signature coordinates
      const fieldMap = await loadFieldMapForSigning(formDoc.form_id, formDoc.language as 'en' | 'es');

      if (!fieldMap) {
        return {
          body: { success: false, message: 'Field map not found for this form — cannot generate signed PDF' },
          status: 422,
        };
      }

      // F5: Load all signature events for this form to get each signer's image
      const { data: allSigEvents, error: sigEventsError } = await supabaseAdmin
        .from('pbv_signature_events')
        .select('signer_member_id, signature_image_path')
        .eq('form_document_id', formDoc.id);

      if (sigEventsError) throw sigEventsError;

      // F5: Build map of member_id -> signature bytes
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

      // F5: Load member slots to determine row index (slot - 1)
      const { data: membersData } = await supabaseAdmin
        .from('pbv_household_members')
        .select('id, slot')
        .eq('full_application_id', app.id)
        .in('id', requiredIds);

      const memberSlotMap = new Map<string, number>();
      for (const m of (membersData ?? [])) {
        memberSlotMap.set(m.id, m.slot);
      }

      // F5: Build signature field data with per-signer markers
      const signatureFieldData = buildSignatureFieldDataF5(
        fieldMap,
        requiredIds,
        memberSlotMap
      );

      const signedPdfBuffer = await stampForm({
        fieldMap,
        data: signatureFieldData,
        sourcePdfBytes: unsignedPdfBytes,
        imageResolver: async (path: string) => {
          // F5: Resolve per-signer signature markers
          if (path.startsWith('__sig__:')) {
            const memberId = path.slice('__sig__:'.length);
            return sigImageMap.get(memberId) ?? null;
          }
          // Fallback for legacy single-sig forms
          if (path === '__sig__') return sigImageBytes;
          return null;
        },
      });

      signedPdfPath = `pbv/${app.id}/forms/${formDoc.form_id}-${formDoc.language}-signed.pdf`;

      await supabaseAdmin.storage
        .from('pbv-forms')
        .upload(signedPdfPath, signedPdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      formDocUpdate.status = 'signed';
      formDocUpdate.signed_pdf_path = signedPdfPath;
      formDocUpdate.finalized_at = new Date().toISOString();

      // Update member signing_device
      await supabaseAdmin
        .from('pbv_household_members')
        .update({ signing_device: device_owner })
        .eq('id', signer_member_id);
    }

    const { error: docUpdateError } = await supabaseAdmin
      .from('pbv_form_documents')
      .update(formDocUpdate)
      .eq('id', formDoc.id);

    if (docUpdateError) throw docUpdateError;

    // ── Check if all forms signed — update signing_status ─────────────────
    if (allSigned) {
      const { data: allDocs } = await supabaseAdmin
        .from('pbv_form_documents')
        .select('status')
        .eq('full_application_id', app.id);

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
          .eq('id', app.id);
      } else {
        await supabaseAdmin
          .from('pbv_full_applications')
          .update({ signing_status: 'in_progress', updated_at: new Date().toISOString() })
          .eq('id', app.id);
      }
    }

    return {
      body: {
        success: true,
        data: {
          form_document_id: formDoc.id,
          signer_member_id,
          all_signed: allSigned,
          status: allSigned ? 'signed' : formDoc.status,
          signed_pdf_path: signedPdfPath,
        },
      },
      status: 200,
    };
  });
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

/**
 * F5: Build signature field data with per-signer markers.
 * For multi-signer forms, emits __sig__:${member_id} keyed by row index (slot - 1).
 */
function buildSignatureFieldDataF5(
  fieldMap: FieldMap,
  requiredSignerIds: string[],
  memberSlotMap: Map<string, number>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Search flat fields for signature images (single-sig forms)
  const sigField = fieldMap.fields.find(
    (f) => f.type === 'image' && f.name.includes('signature')
  );
  if (sigField) {
    // For single-sig forms, use first required signer
    result[sigField.name] = `__sig__:${requiredSignerIds[0]}`;
  }

  // F5: Search row_patterns[].columns for signature images (multi-sig table forms)
  const rowPatterns = fieldMap.row_patterns ?? (fieldMap.row_pattern ? [fieldMap.row_pattern] : []);
  for (const pattern of rowPatterns) {
    for (const col of pattern.columns) {
      const key = col.member_key ?? col.field_prefix ?? '';
      if (col.type === 'image' && key.includes('signature')) {
        // For each row, map to the member in that slot (row 0 = slot 1 = HOH)
        for (const memberId of requiredSignerIds) {
          const slot = memberSlotMap.get(memberId) ?? 1;
          const rowIndex = slot - 1; // HOH = row 0, spouse = row 1, etc.
          result[`__row_pattern:${pattern.data_key}:signature:${rowIndex}`] = `__sig__:${memberId}`;
        }
      }
    }
  }

  return result;
}

/** @deprecated Use buildSignatureFieldDataF5 for multi-signer support */
function buildSignatureFieldData(
  fieldMap: FieldMap,
  _typedName: string,
  _sigBytes: Buffer
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Search flat fields for signature images
  const sigField = fieldMap.fields.find(
    (f) => f.type === 'image' && f.name.includes('signature')
  );
  if (sigField) {
    result[sigField.name] = '__sig__';
  }

  // H1: Search row_patterns[].columns for signature images (table-style forms)
  const rowPatterns = fieldMap.row_patterns ?? (fieldMap.row_pattern ? [fieldMap.row_pattern] : []);
  for (const pattern of rowPatterns) {
    for (const col of pattern.columns) {
      const key = col.member_key ?? col.field_prefix ?? '';
      if (col.type === 'image' && key.includes('signature')) {
        // Marker for row-pattern signatures (H2: multi-signer handled via repeated calls)
        result[`__row_pattern:${pattern.data_key}:signature`] = '__sig__';
      }
    }
  }

  return result;
}
