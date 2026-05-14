/**
 * Tenant Signing - Consent Step API
 * GET: Returns active consent text in application's language
 * POST: Records consent acceptance
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { loadActiveConsent, ConsentLanguage } from '@/lib/signing/capture/consent';
import { getOrCreateCaptureState } from '@/lib/signing/capture/capture-state';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string; signatureId: string }> }
) {
  try {
    const { token, signatureId } = await context.params;

    // Verify tenant token and get application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, preferred_language')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify signature exists and is for this application
    const { data: sig, error: sigError } = await supabaseAdmin
      .from('packet_signatures')
      .select('id, packet_id, signing_packets!inner(application_id)')
      .eq('id', signatureId)
      .single();

    if (sigError || !sig) {
      return NextResponse.json(
        { success: false, message: 'Signature not found' },
        { status: 404 }
      );
    }

    // Check application matches
    const packet = sig.signing_packets as unknown as { application_id: string };
    if (packet.application_id !== app.id) {
      return NextResponse.json(
        { success: false, message: 'Signature not found for this application' },
        { status: 403 }
      );
    }

    // Check signature isn't already signed
    const { data: sigStatus } = await supabaseAdmin
      .from('packet_signatures')
      .select('status')
      .eq('id', signatureId)
      .single();

    if (sigStatus?.status === 'signed' || sigStatus?.status === 'executed') {
      return NextResponse.json(
        { success: false, message: 'Document already signed' },
        { status: 409 }
      );
    }

    // Determine language
    const rawLang = app.preferred_language ?? 'en';
    const lang: ConsentLanguage = ['en', 'es', 'ht'].includes(rawLang) ? (rawLang as ConsentLanguage) : 'en';

    // Load consent text
    const consent = await loadActiveConsent(lang);

    // Get or create capture state
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    const state = await getOrCreateCaptureState(
      signatureId,
      'tenant',
      token,
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
    console.error('Tenant consent GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; signatureId: string }> }
) {
  try {
    const { token, signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.accepted || body.accepted !== true) {
      return NextResponse.json(
        { success: false, message: 'Consent must be accepted' },
        { status: 400 }
      );
    }

    // Verify tenant token
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, preferred_language')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get capture state
    const forwardedFor2 = request.headers.get('x-forwarded-for');
    const ip = forwardedFor2 ? forwardedFor2.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    const state = await getOrCreateCaptureState(
      signatureId,
      'tenant',
      token,
      ip,
      userAgent
    );

    if (state.step !== 'consent') {
      return NextResponse.json(
        { success: false, message: `Invalid step: ${state.step}` },
        { status: 400 }
      );
    }

    // Determine language
    const rawLang2 = app.preferred_language ?? 'en';
    const lang: ConsentLanguage = ['en', 'es', 'ht'].includes(rawLang2) ? (rawLang2 as ConsentLanguage) : 'en';

    // Load consent to get version
    const consent = await loadActiveConsent(lang);

    // Record consent
    await recordConsent(state.id, consent.versionKey, consent.language);

    return NextResponse.json({
      success: true,
      data: {
        nextStep: 'identity',
        consentVersion: consent.versionKey,
      },
    });
  } catch (error: any) {
    console.error('Tenant consent POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// Import at end to avoid circular reference issues
import { recordConsent } from '@/lib/signing/capture/capture-state';
