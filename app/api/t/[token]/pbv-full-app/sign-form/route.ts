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
import { validateSignFormBody } from '@/lib/pbv/signing/validateSignFormBody';
import { getSession } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  const body = await request.json().catch(() => null);

  // PRD-77 #6 (tenant): UUID + enum validation BEFORE any DB work. The
  // pre-PRD-77 presence-only check let malformed UUIDs propagate to Supabase
  // (opaque error) and crafted device_owner values reach the CHECK constraint
  // round-trip.
  const validation = validateSignFormBody(body, { requireSignerMemberId: true });
  if (!validation.ok) {
    return NextResponse.json(
      { success: false, message: validation.message },
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
    // PRD-64 (audit #4): X-Assisted-By is an audit-integrity signal — HACH
    // sees it as "staff X assisted this signature." The pre-PRD-64 check
    // accepted any admin_users.id (existence-only), which any client able to
    // reach this route could spoof. We now require the header to match the
    // CURRENT request's active assisted staff session: getSession() reads the
    // signed httpOnly admin_session cookie (the same cookie the
    // /api/t/[token]/pbv-full-app/assisted-mode GET route reads), and we
    // verify both staffUserId and applicationId. Mismatch -> 401 fail-closed
    // (do NOT silently downgrade to a self-signed event).
    const assistedByHeader = request.headers.get('X-Assisted-By');
    let assistedByStaffUserId: string | null = null;
    if (assistedByHeader) {
      let assistedMode: { staffUserId: string; applicationId: string } | undefined;
      try {
        const session = await getSession();
        assistedMode = session.assistedMode;
      } catch {
        assistedMode = undefined;
      }

      const verified =
        !!assistedMode &&
        assistedMode.staffUserId === assistedByHeader &&
        assistedMode.applicationId === app.id;

      if (!verified) {
        console.warn(
          JSON.stringify({
            event: 'assisted_by_unverified',
            header_value: assistedByHeader,
            app_id: app.id,
            has_session: !!assistedMode,
          })
        );
        return {
          body: { success: false, code: 'assisted_session_unverified', message: 'Assisted-by header could not be verified against an active staff session' },
          status: 401,
        };
      }

      assistedByStaffUserId = assistedMode!.staffUserId;
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
