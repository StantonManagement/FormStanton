/**
 * Tenant Signing - Identity Verification API
 * POST: Validates DOB against household head
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyTenantIdentity, isLockedOut } from '@/lib/signing/capture/identity';
import { loadCaptureState, recordIdentityVerified } from '@/lib/signing/capture/capture-state';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; signatureId: string }> }
) {
  try {
    const { token, signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.dateOfBirth) {
      return NextResponse.json(
        { success: false, message: 'Date of birth is required' },
        { status: 400 }
      );
    }

    // Verify tenant token
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get capture state
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Load state
    const state = await loadCaptureState(body.stateId);
    if (!state) {
      return NextResponse.json(
        { success: false, message: 'Session expired. Please start over.' },
        { status: 400 }
      );
    }

    // Verify state matches
    if (state.packetSignatureId !== signatureId || state.tenantToken !== token) {
      return NextResponse.json(
        { success: false, message: 'Invalid session' },
        { status: 403 }
      );
    }

    // Check lockout
    const { locked, lockedUntil } = await isLockedOut(state.id);
    if (locked) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Too many failed attempts. Please try again after ${lockedUntil?.toLocaleString()}.`,
          lockedUntil: lockedUntil?.toISOString(),
        },
        { status: 429 }
      );
    }

    if (state.step !== 'identity') {
      return NextResponse.json(
        { success: false, message: `Invalid step: ${state.step}` },
        { status: 400 }
      );
    }

    // Verify identity
    const result = await verifyTenantIdentity(token, body.dateOfBirth, state.id);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          message: result.error,
          attemptsRemaining: result.attemptsRemaining,
          lockedUntil: result.lockedUntil?.toISOString(),
        },
        { status: result.lockedUntil ? 429 : 403 }
      );
    }

    // Record identity verification
    await recordIdentityVerified(state.id);

    return NextResponse.json({
      success: true,
      data: {
        nextStep: 'review',
      },
    });
  } catch (error: any) {
    console.error('Tenant identity POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
