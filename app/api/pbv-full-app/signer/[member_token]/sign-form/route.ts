/**
 * POST /api/pbv-full-app/signer/[member_token]/sign-form
 *
 * Records a per-form signature event for a non-HOH adult on a magic link.
 * device_owner is always 'self' (they're on their own device).
 *
 * Body:
 *   form_document_id, typed_name, signature_image_path, ceremony_id,
 *   consent_text_version
 *
 * Returns 410 if link expired. Returns 409 if already signed (idempotent).
 * Returns 409 if parent application already submitted (F8 lock check).
 * Does NOT require HOH summary to be signed first (non-HOH adults may sign
 * independently of HOH signing status).
 *
 * F2: Now uses shared completion logic from lib/pbv/signing/completeForm.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { headers } from 'next/headers';
import { completeFormSigning } from '@/lib/pbv/signing/completeForm';
import { isMagicLinkExpired } from '@/lib/pbv/magicLinkExpiry';
import { validateSignFormBody } from '@/lib/pbv/signing/validateSignFormBody';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ member_token: string }> }
) {
  try {
    const { member_token } = await context.params;

    const { data: member } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, name, full_application_id, magic_link_expires_at')
      .eq('magic_link_token', member_token)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ success: false, message: 'Link not found.' }, { status: 404 });
    }
    // PRD-78 #8: centralized epoch-based expiry check (matches the bootstrap
    // GET route; both now use the same helper).
    if (isMagicLinkExpired(member.magic_link_expires_at)) {
      return NextResponse.json({ success: false, message: 'This link has expired.', code: 'expired' }, { status: 410 });
    }

    const body = await request.json().catch(() => null);

    // PRD-78 #6 (member route): shared validator. requireSignerMemberId: false
    // because the member is derived from the magic-link token, not the body.
    // device_owner is hard-coded 'self' below — the validator's enum branch
    // is skipped for the member route (no body field).
    const validation = validateSignFormBody(body, { requireSignerMemberId: false });
    if (!validation.ok) {
      return NextResponse.json(
        { success: false, message: validation.message },
        { status: 400 }
      );
    }

    const { form_document_id, typed_name, signature_image_path, ceremony_id, consent_text_version } = body as {
      form_document_id: string;
      typed_name: string;
      signature_image_path: string;
      ceremony_id: string;
      consent_text_version?: string;
    };

    // F8: Check parent application lock (submitted_at must be null)
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, submitted_at')
      .eq('id', member.full_application_id)
      .maybeSingle();

    if (app?.submitted_at) {
      return NextResponse.json(
        { success: false, message: 'Application already submitted', code: 'submitted_locked' },
        { status: 409 }
      );
    }

    // F2 / PRD-62: Use shared completion logic (same as HOH route)
    const headerStore = await headers();
    const ipAddress = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? null;
    const userAgent = headerStore.get('user-agent') ?? null;

    const result = await completeFormSigning({
      formDocId: form_document_id,
      appId: member.full_application_id,
      signerMemberId: member.id,
      deviceOwner: 'self',
      signatureImagePath: signature_image_path,
      ceremonyId: ceremony_id,
      consentTextVersion: consent_text_version ?? '2026-05-15-v1',
      typedName: typed_name,
      assistedByStaffUserId: null,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error ?? 'Signing failed' },
        { status: result.error?.includes('not found') ? 404 : 422 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        already_signed: result.alreadySigned,
        all_signed: result.allSigned,
        status: result.status,
        signed_pdf_path: result.signedPdfPath,
      },
    });
  } catch (error: any) {
    console.error('[signer-sign-form] POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
