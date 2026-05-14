/**
 * GET /api/tenant/pbv/[token]/signing
 *
 * Returns signing packet + signatures for tenant portal.
 * Validates magic-link token and filters to tenant-only signatures.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Validate token and get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, building_address, unit_number, tenant_access_token, hach_review_status')
      .eq('tenant_access_token', token)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired access token' },
        { status: 401 }
      );
    }

    // Check if HACH has approved
    if (application.hach_review_status !== 'approved_by_hach') {
      return NextResponse.json(
        { success: false, message: 'Signing not available yet' },
        { status: 403 }
      );
    }

    // Get signing packet
    const { data: packet, error: packetError } = await supabaseAdmin
      .from('signing_packets')
      .select('*')
      .eq('application_id', application.id)
      .single();

    if (packetError || !packet) {
      return NextResponse.json({
        success: true,
        data: {
          application: {
            id: application.id,
            head_of_household_name: application.head_of_household_name,
            building_address: application.building_address,
            unit_number: application.unit_number,
          },
          packet: null,
          signatures: [],
          is_executed: false,
        },
      });
    }

    // Get signatures - filter to tenant-only for HACH wall
    const { data: signatures, error: sigsError } = await supabaseAdmin
      .from('packet_signatures')
      .select('*')
      .eq('packet_id', packet.id)
      .in('signing_party', ['tenant', 'tenant_and_stanton']) // HACH wall: only tenant signatures
      .order('display_order', { ascending: true });

    if (sigsError) {
      throw new Error(`Failed to load signatures: ${sigsError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        packet: {
          id: packet.id,
          template_key: packet.template_key,
          is_executed: packet.executed_at !== null,
        },
        signatures: signatures || [],
        application: {
          id: application.id,
          head_of_household_name: application.head_of_household_name,
          building_address: application.building_address,
          unit_number: application.unit_number,
        },
      },
    });

  } catch (error: any) {
    console.error('[tenant signing GET] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
