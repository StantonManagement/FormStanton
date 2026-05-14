/**
 * GET /api/admin/pbv/full-applications/[id]/signing
 * 
 * Returns the signing packet + signatures + config-gap state.
 * Auto-creates the packet on first access if HACH approved and none exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { loadTemplate, generatePacketSignatures } from '@/lib/signing/packet-template';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;

  try {
    // Fetch application details
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, building_address, hach_review_status, head_of_household_name, unit_number')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    // Check if HACH has approved
    if (application.hach_review_status !== 'approved_by_hach') {
      return NextResponse.json(
        { success: false, message: 'Signing packet only available after HACH approval' },
        { status: 403 }
      );
    }

    // Look for existing packet
    let { data: packet } = await supabaseAdmin
      .from('signing_packets')
      .select('*')
      .eq('application_id', applicationId)
      .single();

    // Auto-create packet if it doesn't exist (lazy creation)
    if (!packet) {
      const generationResult = await generatePacketSignatures(
        { id: applicationId, building_address: application.building_address },
        'default_pbv'
      );

      // Insert packet
      const { data: newPacket, error: packetError } = await supabaseAdmin
        .from('signing_packets')
        .insert({
          application_id: applicationId,
          template_key: 'default_pbv',
          created_by: user.userId,
        })
        .select()
        .single();

      if (packetError || !newPacket) {
        throw new Error(`Failed to create signing packet: ${packetError?.message}`);
      }

      packet = newPacket;

      // Insert signature rows
      const signatureRows = generationResult.signatures.map((sig, index) => ({
        packet_id: packet!.id,
        document_slug: sig.document_slug,
        document_label: sig.document_label,
        signing_party: sig.signing_party,
        is_required: sig.is_required,
        is_template_default: sig.is_template_default,
        plain_language_description: sig.plain_language_description,
        notes: sig.conditional_note || null,
        display_order: index,
      }));

      const { error: sigsError } = await supabaseAdmin
        .from('packet_signatures')
        .insert(signatureRows);

      if (sigsError) {
        throw new Error(`Failed to create signature rows: ${sigsError.message}`);
      }

      // Write event
      await writePbvApplicationEvent({
        applicationId,
        eventType: 'signing_packet_created',
        actorUserId: user.userId,
        actorDisplayName: user.displayName,
        payload: {
          template_key: 'default_pbv',
          signature_count: signatureRows.length,
        },
      });
    }

    // Fetch signatures with packet
    const { data: signatures, error: sigsError } = await supabaseAdmin
      .from('packet_signatures')
      .select('*')
      .eq('packet_id', packet.id)
      .order('display_order', { ascending: true });

    if (sigsError) {
      throw new Error(`Failed to load signatures: ${sigsError.message}`);
    }

    // Check for config gaps
    const generationResult = await generatePacketSignatures(
      { id: applicationId, building_address: application.building_address },
      packet.template_key
    );

    // Get HAP signature status
    const hapSignature = signatures?.find(s => s.signing_party === 'stanton_and_hach');

    return NextResponse.json({
      success: true,
      data: {
        packet: {
          ...packet,
          is_executed: packet.executed_at !== null,
        },
        signatures: signatures || [],
        application: {
          id: applicationId,
          head_of_household_name: application.head_of_household_name,
          unit_number: application.unit_number,
          building_address: application.building_address,
        },
        config_gaps: generationResult.config_gaps,
        hap_signature: hapSignature || null,
      },
    });

  } catch (error: any) {
    console.error('[signing GET] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
