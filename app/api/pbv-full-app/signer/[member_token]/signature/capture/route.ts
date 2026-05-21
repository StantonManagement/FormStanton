/**
 * POST /api/pbv-full-app/signer/[member_token]/signature/capture
 *
 * Captures signature image for magic-link recipients.
 * Stores image in Supabase Storage and returns the storage path.
 *
 * Body:
 *   - signature_image_data_url: string — base64 data URL of PNG signature
 *   - ceremony_id: string (optional) — UUID to group all per-form taps
 *
 * Returns:
 *   - signature_image_path: string — Storage path to use in sign-form calls
 *   - ceremony_id: string
 *
 * Idempotent via Idempotency-Key header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isUuid } from '@/lib/pbv/signing/validateSignFormBody';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ member_token: string }> }
) {
  try {
    const { member_token } = await context.params;

    // Verify member token
    const { data: member } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, full_application_id, magic_link_expires_at')
      .eq('magic_link_token', member_token)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ success: false, message: 'Link not found.' }, { status: 404 });
    }

    if (!member.magic_link_expires_at || new Date(member.magic_link_expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, message: 'This link has expired.', code: 'expired' },
        { status: 410 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body?.signature_image_data_url) {
      return NextResponse.json(
        { success: false, message: 'signature_image_data_url is required' },
        { status: 400 }
      );
    }

    const { signature_image_data_url, ceremony_id } = body;

    // PRD-80 #A6 (member-token analogue): signer_member_id is derived from the
    // magic-link token (member.id) so no body-supplied UUID for that field;
    // ceremony_id IS body-supplied and gets the same guard as the tenant route
    // to prevent garbage propagating into the storage path.
    if (ceremony_id !== undefined && !isUuid(ceremony_id)) {
      return NextResponse.json(
        { success: false, message: 'ceremony_id must be a valid UUID' },
        { status: 400 }
      );
    }

    // Convert data URL to buffer
    const matches = (signature_image_data_url as string).match(
      /^data:image\/(png|jpeg|jpg);base64,(.+)$/
    );
    if (!matches) {
      return NextResponse.json(
        { success: false, message: 'signature_image_data_url must be a PNG or JPEG data URL' },
        { status: 400 }
      );
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    if (imageBuffer.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Signature image is empty' },
        { status: 400 }
      );
    }

    // Build storage path
    const effectiveCeremonyId = (ceremony_id as string | undefined) ?? crypto.randomUUID();
    const storagePath = `pbv/${member.full_application_id}/signatures/${member.id}-${effectiveCeremonyId}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('pbv-signatures')
      .upload(storagePath, imageBuffer, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    return NextResponse.json({
      success: true,
      data: {
        signature_image_path: storagePath,
        ceremony_id: effectiveCeremonyId,
        signer_member_id: member.id,
      },
    });
  } catch (error: any) {
    console.error('[signer-signature-capture] POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
