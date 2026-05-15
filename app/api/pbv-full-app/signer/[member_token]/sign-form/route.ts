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
 * Does NOT require HOH summary to be signed first (non-HOH adults may sign
 * independently of HOH signing status).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { headers } from 'next/headers';

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
    if (!member.magic_link_expires_at || new Date(member.magic_link_expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'This link has expired.', code: 'expired' }, { status: 410 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.form_document_id || !body?.typed_name || !body?.signature_image_path || !body?.ceremony_id) {
      return NextResponse.json(
        { success: false, message: 'form_document_id, typed_name, signature_image_path, ceremony_id required' },
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

    // Verify form belongs to this application
    const { data: formDoc } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, full_application_id')
      .eq('id', form_document_id)
      .eq('full_application_id', member.full_application_id)
      .maybeSingle();

    if (!formDoc) {
      return NextResponse.json({ success: false, message: 'Form not found for this application.' }, { status: 404 });
    }

    // Idempotency: check existing signature event
    const { data: existing } = await supabaseAdmin
      .from('pbv_signature_events')
      .select('id')
      .eq('form_document_id', form_document_id)
      .eq('signer_member_id', member.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, data: { already_signed: true } });
    }

    const headerStore = await headers();
    const ipAddress = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? null;
    const userAgent = headerStore.get('user-agent') ?? null;

    const { error: insertError } = await supabaseAdmin
      .from('pbv_signature_events')
      .insert({
        full_application_id: member.full_application_id,
        form_document_id,
        signer_member_id: member.id,
        typed_name,
        signature_image_path,
        ceremony_id,
        device_owner: 'self',
        consent_text_version: consent_text_version ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        signed_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, data: { already_signed: false } });
  } catch (error: any) {
    console.error('[signer-sign-form] POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
