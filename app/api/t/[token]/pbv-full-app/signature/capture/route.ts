/**
 * POST /api/t/[token]/pbv-full-app/signature/capture
 *
 * Captures the one signature image at ceremony start.
 * Returns a signature_image_ref token (the Storage path) to be used
 * in all subsequent sign-form calls within this ceremony.
 *
 * Body:
 *   - signature_image_data_url: string — base64 data URL of the PNG signature
 *   - signer_member_id: string — UUID of the household member signing
 *   - ceremony_id: string (optional) — UUID to group all per-form taps
 *
 * The image is stored in Supabase Storage; the path (not base64) is referenced
 * in pbv_signature_events per the anti-pattern rule: no base64 in DB.
 *
 * Idempotent via Idempotency-Key header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { withIdempotency } from '@/lib/idempotency';


export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withIdempotency(request, '', 'signature-capture', async () => withTenantContext(request, token, 'signature-capture', async (app) => {
    const body = await request.json().catch(() => null);

    if (!body?.signature_image_data_url || !body?.signer_member_id) {
      return {
        body: {
          success: false,
          message: 'signature_image_data_url and signer_member_id are required',
        },
        status: 400,
      };
    }

    const { signature_image_data_url, signer_member_id, ceremony_id } = body;

    // Verify the member belongs to this application
    const { data: member, error: memberError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id')
      .eq('id', signer_member_id)
      .eq('full_application_id', app.id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) {
      return { body: { success: false, message: 'Signer member not found' }, status: 404 };
    }

    // Convert data URL to buffer
    const matches = (signature_image_data_url as string).match(
      /^data:image\/(png|jpeg|jpg);base64,(.+)$/
    );
    if (!matches) {
      return {
        body: { success: false, message: 'signature_image_data_url must be a PNG or JPEG data URL' },
        status: 400,
      };
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');

    if (imageBuffer.length === 0) {
      return { body: { success: false, message: 'Signature image is empty' }, status: 400 };
    }

    // Build storage path
    const effectiveCeremonyId = (ceremony_id as string | undefined) ?? crypto.randomUUID();
    const storagePath = `pbv/${app.id}/signatures/${signer_member_id}-${effectiveCeremonyId}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('pbv-signatures')
      .upload(storagePath, imageBuffer, {
        contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    return {
      body: {
        success: true,
        data: {
          signature_image_path: storagePath,
          ceremony_id: effectiveCeremonyId,
          signer_member_id,
        },
      },
      status: 200,
    };
  }));
}
