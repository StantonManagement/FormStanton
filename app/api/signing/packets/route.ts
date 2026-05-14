/**
 * POST /api/signing/packets
 * 
 * Creates a signing packet for a PBV full application.
 * Only allowed after HACH approval.
 * 
 * Request body:
 * {
 *   application_id: string,
 *   template_key?: string (defaults to 'default_pbv'),
 *   notes?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePacketSignatures } from '@/lib/signing/packet-template';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { requirePermission, getSessionUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('pbv-full-applications', 'read');
    if (authResult) {
      return authResult;
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { application_id, template_key = 'default_pbv', notes } = body;

    if (!application_id) {
      return NextResponse.json({ error: 'application_id is required' }, { status: 400 });
    }

    // Verify application exists and is HACH approved
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('*')
      .eq('id', application_id)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    if (application.hach_review_status !== 'approved_by_hach') {
      return NextResponse.json(
        { error: 'Application must be approved by HACH before creating signing packet' },
        { status: 400 }
      );
    }

    // Check if packet already exists
    const { data: existingPacket } = await supabaseAdmin
      .from('signing_packets')
      .select('id')
      .eq('application_id', application_id)
      .single();

    if (existingPacket) {
      return NextResponse.json({ error: 'Signing packet already exists for this application' }, { status: 409 });
    }

    // Generate signatures using template system
    const signatureResult = await generatePacketSignatures(
      {
        id: application.id,
        building_address: application.building_address
      },
      template_key
    );

    // Create signing packet
    const { data: packet, error: packetError } = await supabaseAdmin
      .from('signing_packets')
      .insert({
        application_id,
        template_key,
        created_by: user.userId,
        notes
      })
      .select()
      .single();

    if (packetError) {
      console.error('Failed to create signing packet:', packetError);
      return NextResponse.json({ error: 'Failed to create signing packet' }, { status: 500 });
    }

    // Create signature rows
    const signatureRows = signatureResult.signatures.map(sig => ({
      packet_id: packet.id,
      document_slug: sig.document_slug,
      document_label: sig.document_label,
      signing_party: sig.signing_party,
      is_required: sig.is_required,
      is_template_default: sig.is_template_default,
      plain_language_description: sig.plain_language_description,
      notes: sig.conditional_note
    }));

    const { error: signaturesError } = await supabaseAdmin
      .from('packet_signatures')
      .insert(signatureRows);

    if (signaturesError) {
      console.error('Failed to create signature rows:', signaturesError);
      // Clean up the packet if signature creation failed
      await supabaseAdmin.from('signing_packets').delete().eq('id', packet.id);
      return NextResponse.json({ error: 'Failed to create signature rows' }, { status: 500 });
    }

    // Write event
    await writePbvApplicationEvent({
      applicationId: application_id,
      eventType: ApplicationEventType.SIGNING_PACKET_CREATED,
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        template_key,
        signature_count: signatureResult.signatures.length
      }
    });

    return NextResponse.json({
      packet,
      signatures: signatureResult.signatures,
      config_gaps: signatureResult.config_gaps
    });

  } catch (error) {
    console.error('Error in POST /api/signing/packets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('pbv-full-applications', 'read');
    if (authResult) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const application_id = searchParams.get('application_id');

    if (!application_id) {
      return NextResponse.json({ error: 'application_id is required' }, { status: 400 });
    }

    // Get packet with signatures
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
          is_template_default,
          status,
          sent_at,
          signed_at,
          signed_pdf_path,
          signature_method,
          waived_reason,
          notes,
          plain_language_description,
          created_at,
          updated_at
        )
      `)
      .eq('application_id', application_id)
      .single();

    if (packetError) {
      if (packetError.code === 'PGRST116') {
        return NextResponse.json({ packet: null, signatures: [] }, { status: 200 });
      }
      console.error('Failed to fetch signing packet:', packetError);
      return NextResponse.json({ error: 'Failed to fetch signing packet' }, { status: 500 });
    }

    return NextResponse.json(packet);

  } catch (error) {
    console.error('Error in GET /api/signing/packets:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
