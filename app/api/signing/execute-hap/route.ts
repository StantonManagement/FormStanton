/**
 * POST /api/signing/execute-hap
 * 
 * Executes the HAP contract for a signing packet.
 * Requires pbv-full-applications:execute_hap permission.
 * 
 * Preconditions:
 * - All required signatures are either 'signed' or 'waived'
 * - HAP signature row exists and is 'signed'
 * - Application is not already executed (packet_locked = false)
 * 
 * Effects:
 * - Sets signing_packets.executed_at and executed_by
 * - Sets pbv_full_applications.stage = 'executed'
 * - Sets pbv_full_applications.packet_locked = true
 * - Writes hap_executed event
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

interface ExecuteHapBody {
  application_id: string;
  direction: 'stanton_first' | 'hach_first';
  hap_file_path?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization - requires specific execute_hap permission
    const authResult = await requirePermission('pbv-full-applications', 'execute_hap');
    if (authResult) {
      return authResult;
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - requires execute_hap permission' }, { status: 401 });
    }

    const body: ExecuteHapBody = await request.json();
    const { application_id, direction, hap_file_path } = body;

    if (!application_id || !direction) {
      return NextResponse.json(
        { error: 'application_id and direction are required' },
        { status: 400 }
      );
    }

    if (!['stanton_first', 'hach_first'].includes(direction)) {
      return NextResponse.json(
        { error: 'direction must be stanton_first or hach_first' },
        { status: 400 }
      );
    }

    // Get application and check preconditions
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (application.packet_locked) {
      return NextResponse.json(
        { error: 'Application is already executed and locked' },
        { status: 400 }
      );
    }

    if (application.hach_review_status !== 'approved_by_hach') {
      return NextResponse.json(
        { error: 'Application must be approved by HACH before HAP execution' },
        { status: 400 }
      );
    }

    // Get signing packet with signatures
    const { data: packet, error: packetError } = await supabaseAdmin
      .from('signing_packets')
      .select(`
        *,
        packet_signatures (
          id,
          document_slug,
          document_label,
          signing_party,
          is_required,
          status,
          signed_at
        )
      `)
      .eq('application_id', application_id)
      .single();

    if (packetError || !packet) {
      return NextResponse.json({ error: 'Signing packet not found' }, { status: 404 });
    }

    if (packet.executed_at) {
      return NextResponse.json(
        { error: 'HAP already executed for this packet' },
        { status: 400 }
      );
    }

    // Check all required signatures are signed or waived
    const requiredSignatures = packet.packet_signatures.filter((sig: any) => sig.is_required);
    const incompleteSignatures = requiredSignatures.filter(
      (sig: any) => !['signed', 'waived'].includes(sig.status)
    );

    if (incompleteSignatures.length > 0) {
      return NextResponse.json({
        error: 'Not all required signatures are complete',
        incomplete_signatures: incompleteSignatures.map((sig: any) => ({
          document_slug: sig.document_slug,
          document_label: sig.document_label,
          status: sig.status
        }))
      }, { status: 400 });
    }

    // Check HAP signature exists and is signed
    const hapSignature = packet.packet_signatures.find((sig: any) => 
      sig.document_slug === 'hap_contract' && sig.signing_party === 'stanton_and_hach'
    );

    if (!hapSignature) {
      return NextResponse.json(
        { error: 'HAP contract signature not found in packet' },
        { status: 400 }
      );
    }

    if (hapSignature.status !== 'signed') {
      return NextResponse.json(
        { error: 'HAP contract must be signed before execution' },
        { status: 400 }
      );
    }

    // Execute the transaction
    const { error: executeError } = await supabaseAdmin.rpc('execute_hap_transaction', {
      p_application_id: application_id,
      p_packet_id: packet.id,
      p_executed_by: user.userId,
      p_direction: direction,
      p_hap_file_path: hap_file_path
    });

    if (executeError) {
      console.error('Failed to execute HAP transaction:', executeError);
      return NextResponse.json(
        { error: 'Failed to execute HAP - transaction rolled back' },
        { status: 500 }
      );
    }

    // Write event
    await writePbvApplicationEvent({
      applicationId: application_id,
      eventType: ApplicationEventType.HAP_EXECUTED,
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        direction,
        hap_file_path
      }
    });

    return NextResponse.json({
      success: true,
      executed_at: new Date().toISOString(),
      direction,
      packet_id: packet.id
    });

  } catch (error) {
    console.error('Error in POST /api/signing/execute-hap:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
