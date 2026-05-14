/**
 * Admin/Staff Signing - Consent Step API
 * GET: Returns active consent text
 * POST: Records consent acceptance
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { loadActiveConsent, ConsentLanguage } from '@/lib/signing/capture/consent';
import { getOrCreateCaptureState, recordConsent } from '@/lib/signing/capture/capture-state';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ signatureId: string }> }
) {
  try {
    // Require admin auth
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { signatureId } = await context.params;

    // Get signature details to determine language from application
    const { data: sig, error: sigError } = await supabaseAdmin
      .from('packet_signatures')
      .select('id, packet_id, status, signing_packets!inner(application_id)')
      .eq('id', signatureId)
      .single();

    if (sigError || !sig) {
      return NextResponse.json(
        { success: false, message: 'Signature not found' },
        { status: 404 }
      );
    }

    // Check not already signed
    if (sig.status === 'signed' || sig.status === 'executed') {
      return NextResponse.json(
        { success: false, message: 'Document already signed' },
        { status: 409 }
      );
    }

    // Get application language
    const packet = sig.signing_packets as unknown as { application_id: string };
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('preferred_language')
      .eq('id', packet.application_id)
      .maybeSingle();

    // Determine language (default to en for staff)
    const rawLang = app?.preferred_language ?? 'en';
    const lang: ConsentLanguage = ['en', 'es', 'ht'].includes(rawLang) ? (rawLang as ConsentLanguage) : 'en';

    // Load consent
    const consent = await loadActiveConsent(lang);

    // Get or create capture state
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const state = await getOrCreateCaptureState(
      signatureId,
      'stanton',
      null, // No tenant token for staff
      ip,
      userAgent
    );

    return NextResponse.json({
      success: true,
      data: {
        consentText: consent.body,
        versionKey: consent.versionKey,
        language: consent.language,
        stateId: state.id,
        step: state.step,
      },
    });
  } catch (error: any) {
    console.error('Admin consent GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ signatureId: string }> }
) {
  try {
    // Require admin auth
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.accepted || body.accepted !== true) {
      return NextResponse.json(
        { success: false, message: 'Consent must be accepted' },
        { status: 400 }
      );
    }

    // Get capture state
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const state = await getOrCreateCaptureState(
      signatureId,
      'stanton',
      null,
      ip,
      userAgent
    );

    if (state.step !== 'consent') {
      return NextResponse.json(
        { success: false, message: `Invalid step: ${state.step}` },
        { status: 400 }
      );
    }

    // Get application language for consent version
    const { data: sig } = await supabaseAdmin
      .from('packet_signatures')
      .select('signing_packets!inner(application_id)')
      .eq('id', signatureId)
      .single();
    
    const packet = sig?.signing_packets as unknown as { application_id: string } | undefined;
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('preferred_language')
      .eq('id', packet?.application_id || '')
      .maybeSingle();

    const rawLang = app?.preferred_language ?? 'en';
    const lang: ConsentLanguage = ['en', 'es', 'ht'].includes(rawLang) ? (rawLang as ConsentLanguage) : 'en';
    const consent = await loadActiveConsent(lang);

    // Record consent (skips identity for staff - goes straight to review)
    await recordConsent(state.id, consent.versionKey, consent.language);
    
    // Staff skips identity verification (admin session is proof of identity)
    // Update state to skip to review step
    await supabaseAdmin
      .from('signature_capture_in_progress')
      .update({
        step: 'review',
        identity_verified_at: new Date().toISOString(),
      })
      .eq('id', state.id);

    return NextResponse.json({
      success: true,
      data: {
        nextStep: 'review', // Staff skips identity step
        consentVersion: consent.versionKey,
      },
    });
  } catch (error: any) {
    console.error('Admin consent POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
