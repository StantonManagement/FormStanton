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

      if (fieldMap) {
        const signatureFieldData = buildSignatureFieldData(fieldMap, typed_name, sigImageBytes);

        const signedPdfBuffer = await stampForm({
          fieldMap,
          data: signatureFieldData,
          sourcePdfBytes: unsignedPdfBytes,
          imageResolver: async (path: string) => {
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
      }

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

function buildSignatureFieldData(
  fieldMap: FieldMap,
  _typedName: string,
  _sigBytes: Buffer
): Record<string, unknown> {
  const sigField = fieldMap.fields.find(
    (f) => f.type === 'image' && f.name.includes('signature')
  );
  if (!sigField) return {};
  return { [sigField.name]: '__sig__' };
}
