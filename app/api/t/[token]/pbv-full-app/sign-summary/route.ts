/**
 * POST /api/t/[token]/pbv-full-app/sign-summary
 *
 * Captures the HOH signature on the summary document.
 * Must be called before any sign-form calls for federal forms.
 * Creates or updates the pbv_summary_documents row for this application.
 *
 * Body:
 *   - typed_name: string
 *   - signature_image_path: string  — storage path from signature/capture
 *   - ceremony_id: string           — UUID from signature/capture
 *   - consent_text_version: string
 *   - template_version: string      — summary template version used in the UI
 *   - language: 'en' | 'es' | 'pt'
 *
 * Idempotent: if summary already signed, returns 200 with existing data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { isUuid } from '@/lib/pbv/signing/validateSignFormBody';
import { getSession } from '@/lib/auth';
import { isKnownConsentVersion } from '@/lib/pbv/consent-text';
import { createHash } from 'crypto';

const SUMMARY_LANGUAGES = ['en', 'es', 'pt'] as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'sign-summary', async (app) => {
   try {
    const body = await request.json().catch(() => null);

    if (!body?.typed_name || !body?.signature_image_path || !body?.ceremony_id) {
      return {
        body: {
          success: false,
          message: 'typed_name, signature_image_path, and ceremony_id are required',
        },
        status: 400,
      };
    }

    const {
      typed_name,
      signature_image_path,
      ceremony_id,
      consent_text_version = '2026-05-15-v1',
      template_version = '2026-05-15-v1',
      language = 'en',
    } = body;

    // PRD-80 #A5: validate UUIDs / enums before any DB work. Pre-PRD-80 the
    // route only checked truthiness, so malformed ceremony_id and out-of-enum
    // language values reached Supabase as opaque errors. Reuses the UUID
    // primitive from PRD-77's validateSignFormBody so both ceremonies share
    // one regex source.
    if (!isUuid(ceremony_id)) {
      return {
        body: { success: false, message: 'ceremony_id must be a valid UUID' },
        status: 400,
      };
    }
    if (!SUMMARY_LANGUAGES.includes(language)) {
      return {
        body: { success: false, message: 'language must be one of en, es, pt' },
        status: 400,
      };
    }
    // template_version: free-form date-like string in the codebase today
    // (e.g. '2026-05-15-v1'); validate non-empty string only. See build
    // report O2 — tighten to a regex if the format is locked down later.
    if (typeof template_version !== 'string' || !template_version.trim()) {
      return {
        body: { success: false, message: 'template_version must be a non-empty string' },
        status: 400,
      };
    }
    // PRP-018 / G1: consent_text_version must be a value the app knows
    // about. The DB-backed consent_versions table is the source of truth
    // long-term; the local allow-list mirrors it and short-circuits the
    // round-trip. Unknown versions cannot be silently accepted because
    // the audit-trail would be unverifiable.
    if (!isKnownConsentVersion(consent_text_version)) {
      return {
        body: {
          success: false,
          message: 'Unknown consent_text_version',
          code: 'unknown_consent_version',
        },
        status: 400,
      };
    }

    // PRD-80 #A1 (CRITICAL): mirror PRD-64's sign-form X-Assisted-By
    // verification. Pre-PRD-80 the sign-summary route only checked that the
    // header value existed in admin_users — any client that knew a valid
    // admin_users.id could attribute a summary signature to a staff member
    // who never assisted. Now the header must match the active assisted
    // staff session (getSession() reads the signed admin_session cookie)
    // AND assistedMode.applicationId must match the resolved app.id, exactly
    // as in app/api/t/[token]/pbv-full-app/sign-form/route.ts.
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
            route: 'sign-summary',
            header_value: assistedByHeader,
            app_id: app.id,
            has_session: !!assistedMode,
          })
        );
        return {
          body: {
            success: false,
            code: 'assisted_session_unverified',
            message: 'Assisted-by header could not be verified against an active staff session',
          },
          status: 401,
        };
      }

      assistedByStaffUserId = assistedMode!.staffUserId;
    }

    // Idempotent check: summary already signed?
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('pbv_summary_documents')
      .select('id, signed_at, signature_event_id')
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.signed_at) {
      return {
        body: {
          success: true,
          data: {
            summary_document_id: existing.id,
            signed_at: existing.signed_at,
            already_signed: true,
          },
        },
        status: 200,
      };
    }

    // Load HOH member id
    const { data: hoh, error: hohError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id')
      .eq('full_application_id', app.id)
      .eq('slot', 1)
      .maybeSingle();

    if (hohError) throw hohError;
    if (!hoh) {
      return { body: { success: false, message: 'Head of household not found' }, status: 422 };
    }

    // Verify signature image exists in storage
    const { data: signatureCheck } = await supabaseAdmin.storage
      .from('pbv-signatures')
      .list(signature_image_path.split('/').slice(0, -1).join('/'));

    const imageFileName = signature_image_path.split('/').pop();
    const imageExists = signatureCheck?.some((f) => f.name === imageFileName);

    if (!imageExists) {
      return {
        body: { success: false, message: 'Signature image not found in storage' },
        status: 400,
      };
    }

    const signedAt = new Date().toISOString();
    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    // F4: Compute document hash of the summary content
    // Use a hash of the summary metadata since we don't have the actual PDF bytes here
    const summaryContent = JSON.stringify({
      app_id: app.id,
      hoh_id: hoh.id,
      language,
      template_version,
      signed_at: signedAt,
    });
    const documentHash = createHash('sha256').update(summaryContent).digest('hex');

    // Create summary document first (needed for signature_event FK)
    let summaryId = existing?.id;

    if (!summaryId) {
      const { data: newSummary, error: insertError } = await supabaseAdmin
        .from('pbv_summary_documents')
        .insert({
          full_application_id: app.id,
          language,
          template_version,
          pdf_storage_path: null,
          created_by: 'tenant',
        })
        .select('id')
        .maybeSingle();

      if (insertError) throw insertError;
      if (!newSummary) throw new Error('Failed to create summary document record');
      summaryId = newSummary.id;
    }

    // F4: Create signature event for summary (form_document_id is NULL for summary)
    const { data: sigEvent, error: sigEventError } = await supabaseAdmin
      .from('pbv_signature_events')
      .insert({
        form_document_id: null, // Summary has no form document
        signer_member_id: hoh.id,
        signature_image_path: signature_image_path,
        typed_name,
        signed_at: signedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_owner: 'self',
        document_hash: documentHash,
        ceremony_id,
        consent_text_version,
        assisted_by_staff_user_id: assistedByStaffUserId,
      })
      .select('id')
      .maybeSingle();

    if (sigEventError) throw sigEventError;

    // Update summary document with signed_at and signature_event_id
    const { error: signError } = await supabaseAdmin
      .from('pbv_summary_documents')
      .update({
        signed_at: signedAt,
        signature_event_id: sigEvent?.id ?? null,
      })
      .eq('id', summaryId);

    if (signError) throw signError;

    // Update signing_status on application
    const { error: appUpdateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ signing_status: 'summary_signed', updated_at: signedAt })
      .eq('id', app.id);

    if (appUpdateError) throw appUpdateError;

    return {
      body: {
        success: true,
        data: {
          summary_document_id: summaryId,
          signed_at: signedAt,
          already_signed: false,
          signature_event_id: sigEvent?.id,
        },
      },
      status: 200,
    };
   } catch (error: any) {
     // Previously this handler had no try/catch, so any DB error surfaced as an
     // opaque 500 with an empty body (which masked the form_document_id NOT NULL
     // violation for weeks). Log the full error server-side for diagnosis and
     // return a generic message to the client.
     console.error('[sign-summary] error:', {
       message: error?.message,
       code: error?.code,
       details: error?.details,
       hint: error?.hint,
     });
     return {
       body: { success: false, message: 'Internal server error', code: 'server_error' },
       status: 500,
     };
   }
  });
}
