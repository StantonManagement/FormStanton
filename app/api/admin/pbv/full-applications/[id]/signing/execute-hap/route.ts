/**
 * POST /api/admin/pbv/full-applications/[id]/signing/execute-hap
 * 
 * Marks the HAP contract as executed.
 * Requires execute_hap permission.
 * Preconditions: HAP signature row exists, signed_pdf_path is non-null, status='signed'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const permError = await requirePermission('pbv-full-applications', 'execute_hap');
  if (permError) return permError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;

  try {
    const body = await request.json();
    const { execution_date } = body;

    // Validate execution date
    const execDate = execution_date ? new Date(execution_date) : new Date();
    if (isNaN(execDate.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid execution date' },
        { status: 400 }
      );
    }

    // Fetch the packet with HAP signature
    const { data: packet, error: packetError } = await supabaseAdmin
      .from('signing_packets')
      .select('*, packet_signatures!inner(*)')
      .eq('application_id', applicationId)
      .single();

    if (packetError || !packet) {
      return NextResponse.json(
        { success: false, message: 'Signing packet not found' },
        { status: 404 }
      );
    }

    // Check if already executed
    if (packet.executed_at) {
      return NextResponse.json(
        { success: false, message: 'HAP contract is already executed' },
        { status: 409 }
      );
    }

    // Find HAP signature
    const signatures = (packet as any).packet_signatures || [];
    const hapSignature = signatures.find(
      (s: any) => s.signing_party === 'stanton_and_hach'
    );

    if (!hapSignature) {
      return NextResponse.json(
        { success: false, message: 'HAP contract signature row not found' },
        { status: 404 }
      );
    }

    // Check HAP is signed
    if (hapSignature.status !== 'signed' || !hapSignature.signed_pdf_path) {
      return NextResponse.json(
        { success: false, message: 'HAP contract must be signed by both parties before execution' },
        { status: 400 }
      );
    }

    // Determine direction from notes
    const notes = hapSignature.notes || '';
    const direction = notes.includes('hach_first') ? 'hach_first' : 'stanton_first';

    // Perform atomic updates
    const now = new Date().toISOString();

    // 1. Update packet
    const { error: packetUpdateError } = await supabaseAdmin
      .from('signing_packets')
      .update({
        executed_at: now,
        executed_by: user.userId,
      })
      .eq('id', packet.id);

    if (packetUpdateError) {
      throw new Error(`Failed to update packet: ${packetUpdateError.message}`);
    }

    // 2. Update HAP signature
    const { error: sigUpdateError } = await supabaseAdmin
      .from('packet_signatures')
      .update({
        status: 'executed',
      })
      .eq('id', hapSignature.id);

    if (sigUpdateError) {
      throw new Error(`Failed to update HAP signature: ${sigUpdateError.message}`);
    }

    // 3. Update application stage
    const { error: appUpdateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        stage: 'executed',
        updated_at: now,
      })
      .eq('id', applicationId);

    if (appUpdateError) {
      throw new Error(`Failed to update application stage: ${appUpdateError.message}`);
    }

    // 4. Write HAP executed event
    await writePbvApplicationEvent({
      applicationId,
      eventType: 'hap_executed',
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        direction,
        hap_file_path: hapSignature.signed_pdf_path,
      },
    });

    // 5. Post system-authored shared workspace message
    const { error: msgError } = await supabaseAdmin
      .from('shared_workspace_messages')
      .insert({
        anchor_type: 'pbv_full_application',
        anchor_id: applicationId,
        author_user_id: null, // System message
        author_display_name: 'System',
        author_party_org: 'stanton',
        content: `Stanton recorded HAP contract execution on ${execDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}. Application is now in force.`,
      });

    if (msgError) {
      // Log but don't fail - the execution is already committed
      console.error('[execute-hap] Failed to post workspace message:', msgError);
    }

    return NextResponse.json({
      success: true,
      message: 'HAP contract executed successfully',
      data: {
        executed_at: now,
        executed_by: user.displayName,
        direction,
      },
    });

  } catch (error: any) {
    console.error('[execute-hap POST] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
