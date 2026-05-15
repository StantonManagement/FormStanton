/**
 * POST /api/admin/pbv/full-applications/[id]/signing/[signatureId]/waive
 * 
 * Waives a required signature with a reason.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signatureId: string }> }
) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, signatureId } = await params;

  try {
    const body = await request.json();
    const { reason } = body;

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, message: 'Reason is required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    // Fetch the signature row
    const { data: signature, error: sigError } = await supabaseAdmin
      .from('packet_signatures')
      .select('*, signing_packets!inner(application_id, executed_at)')
      .eq('id', signatureId)
      .single();

    if (sigError || !signature) {
      return NextResponse.json(
        { success: false, message: 'Signature not found' },
        { status: 404 }
      );
    }

    // Verify packet belongs to this application
    if ((signature as any).signing_packets?.application_id !== applicationId) {
      return NextResponse.json(
        { success: false, message: 'Signature does not belong to this application' },
        { status: 403 }
      );
    }

    // Check if packet is already executed
    if ((signature as any).signing_packets?.executed_at) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked after HAP execution' },
        { status: 423 }
      );
    }

    // Cannot waive the HAP contract
    if (signature.signing_party === 'stanton_and_hach') {
      return NextResponse.json(
        { success: false, message: 'The HAP contract cannot be waived' },
        { status: 400 }
      );
    }

    // Update signature
    const { error: updateError } = await supabaseAdmin
      .from('packet_signatures')
      .update({
        status: 'waived',
        waived_reason: reason.trim(),
      })
      .eq('id', signatureId);

    if (updateError) {
      throw new Error(`Failed to waive signature: ${updateError.message}`);
    }

    // Write event
    await writePbvApplicationEvent({
      applicationId,
      eventType: 'signature_waived',
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        document_slug: signature.document_slug,
        document_label: signature.document_label,
        signing_party: signature.signing_party,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Signature waived',
    });

  } catch (error: any) {
    console.error('[signature waive POST] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
