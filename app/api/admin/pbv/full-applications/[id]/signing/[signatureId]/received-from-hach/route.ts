/**
 * POST /api/admin/pbv/full-applications/[id]/signing/[signatureId]/received-from-hach
 * 
 * HACH-sends-first path entry point.
 * Records that HACH sent the HAP contract first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signatureId: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, signatureId } = await params;

  try {
    const body = await request.json();
    const { note } = body;

    // Fetch the signature row - must be HAP contract
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

    // Verify it's the HAP contract
    if (signature.signing_party !== 'stanton_and_hach') {
      return NextResponse.json(
        { success: false, message: 'This action is only for the HAP contract' },
        { status: 400 }
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

    // Update signature
    const notes = ['hap_initiation_direction: hach_first'];
    if (note) notes.push(note);

    const { error: updateError } = await supabaseAdmin
      .from('packet_signatures')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_by: user.userId,
        notes: notes.join('\n'),
      })
      .eq('id', signatureId);

    if (updateError) {
      throw new Error(`Failed to update signature: ${updateError.message}`);
    }

    // Write HAP received event
    await writePbvApplicationEvent({
      applicationId,
      eventType: 'hap_received_from_hach',
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        document_slug: signature.document_slug,
        document_label: signature.document_label,
        initiation_direction: 'hach_first',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'HAP contract marked as received from HACH',
    });

  } catch (error: any) {
    console.error('[received-from-hach POST] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
