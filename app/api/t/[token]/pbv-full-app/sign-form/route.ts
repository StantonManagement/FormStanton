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
 * Idempotent via Idempotency-Key header.
 *
 * PRD-62: Delegates the signing flow to lib/pbv/signing/completeFormSigning so
 * the HOH and member-token paths share one implementation. The HOH route keeps
 * the summary-doc-signed gate (HOH-only precondition) + the X-Assisted-By
 * resolver + the custom idempotency key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { completeFormSigning } from '@/lib/pbv/signing/completeForm';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const body = await request.json().catch(() => null);

  if (!body?.form_document_id || !body?.signer_member_id || !body?.typed_name ||
      !body?.signature_image_path || !body?.ceremony_id) {
    return NextResponse.json(
      {
        success: false,
        message: 'form_document_id, signer_member_id, typed_name, signature_image_path, and ceremony_id are required',
      },
      { status: 400 }
    );
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

  const idempotencyKey = `sign-form:${ceremony_id}:${form_document_id}`;

  return withTenantContext(request, token, 'sign-form', async (app) => {
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

    // ── HOH-only gate: summary doc must be signed first ─────────────────────
    // (Member-token route intentionally omits this — non-HOH adults may sign
    //  independently of HOH summary status.)
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

    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const result = await completeFormSigning({
      formDocId: form_document_id,
      appId: app.id,
      signerMemberId: signer_member_id,
      deviceOwner: device_owner,
      signatureImagePath: signature_image_path,
      ceremonyId: ceremony_id,
      consentTextVersion: consent_text_version,
      typedName: typed_name,
      assistedByStaffUserId,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      const status = result.error?.toLowerCase().includes('not found') ? 404 : 422;
      return {
        body: { success: false, message: result.error ?? 'Signing failed' },
        status,
      };
    }

    return {
      body: {
        success: true,
        data: {
          form_document_id,
          signer_member_id,
          all_signed: result.allSigned,
          status: result.status,
          signed_pdf_path: result.signedPdfPath ?? null,
        },
      },
      status: 200,
    };
  }, undefined, idempotencyKey);
}
