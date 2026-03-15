import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const building = searchParams.get('building');
    const unit = searchParams.get('unit');

    if (!building || !unit) {
      return NextResponse.json(
        { success: false, message: 'Building address and unit number required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_insurance_policies')
      .select('*')
      .eq('building_address', building)
      .eq('unit_number', unit)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching insurance:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch insurance data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      policy: data && data.length > 0 ? data[0] : null,
    });
  } catch (error: any) {
    console.error('Insurance GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch insurance' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      tenant_name,
      building_address,
      unit_number,
      insurance_type,
      provider,
      policy_number,
      liability_coverage,
      policy_expiration,
      additional_insured_added,
      proof_received,
      has_pets,
      created_by,
    } = body;

    if (!tenant_name || !building_address || !unit_number || !insurance_type || !created_by) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Mark any existing current policy as not current
    await supabaseAdmin
      .from('tenant_insurance_policies')
      .update({ is_current: false })
      .eq('building_address', building_address)
      .eq('unit_number', unit_number)
      .eq('is_current', true);

    // Insert new policy
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('tenant_insurance_policies')
      .insert({
        tenant_name,
        building_address,
        unit_number,
        insurance_type,
        provider: provider || null,
        policy_number: policy_number || null,
        liability_coverage: liability_coverage || null,
        policy_expiration: policy_expiration || null,
        additional_insured_added: additional_insured_added || false,
        additional_insured_confirmed_at: additional_insured_added ? now : null,
        proof_received: proof_received || false,
        proof_received_at: proof_received ? now : null,
        has_pets: has_pets || false,
        is_current: true,
        created_by,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving insurance:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to save insurance policy' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, policy: data });
  } catch (error: any) {
    console.error('Insurance POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save insurance' },
      { status: 500 }
    );
  }
}
