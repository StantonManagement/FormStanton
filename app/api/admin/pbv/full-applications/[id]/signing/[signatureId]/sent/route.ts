/**
 * POST /api/admin/pbv/full-applications/[id]/signing/[signatureId]/sent
 * 
 * Marks a signature as sent to the signing party.
 * For HAP contract, can also set the initiation direction.
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
    const { note, hap_initiation_direction } = body;

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

    // Update signature
    const updateData: any = {
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: user.userId,
    };

    // Add note if provided (including HAP initiation direction)
    if (note || hap_initiation_direction) {
      const notes = [];
      if (note) notes.push(note);
      if (hap_initiation_direction) {
        notes.push(`hap_initiation_direction: ${hap_initiation_direction}`);
      }
      updateData.notes = notes.join('\n');
    }

    const { error: updateError } = await supabaseAdmin
      .from('packet_signatures')
      .update(updateData)
      .eq('id', signatureId);

    if (updateError) {
      throw new Error(`Failed to update signature: ${updateError.message}`);
    }

    // Write event
    await writePbvApplicationEvent({
      applicationId,
      eventType: 'signature_marked_sent',
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        document_slug: signature.document_slug,
        document_label: signature.document_label,
        signing_party: signature.signing_party,
        note: note || null,
        hap_initiation_direction: hap_initiation_direction || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Signature marked as sent',
    });

  } catch (error: any) {
    console.error('[signature sent POST] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
