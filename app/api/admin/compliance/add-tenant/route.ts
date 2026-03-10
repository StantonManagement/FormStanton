import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthenticated } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      firstName,
      lastName,
      phone,
      email,
      unitNumber,
      buildingAddress,
      status,
    } = body;

    if (!buildingAddress || !unitNumber) {
      return NextResponse.json(
        { success: false, message: 'Building address and unit number are required' },
        { status: 400 }
      );
    }

    if (!name && !firstName && !lastName) {
      return NextResponse.json(
        { success: false, message: 'Tenant name is required' },
        { status: 400 }
      );
    }

    // Check if tenant already exists at this unit
    const { data: existing, error: lookupError } = await supabase
      .from('tenant_lookup')
      .select('id, name, is_current')
      .eq('building_address', buildingAddress)
      .eq('unit_number', unitNumber)
      .eq('is_current', true);

    if (lookupError) {
      console.error('Error checking existing tenant:', lookupError);
      return NextResponse.json(
        { success: false, message: 'Failed to check for existing tenant' },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `A current tenant already exists at ${buildingAddress} Unit ${unitNumber}: ${existing[0].name}. Mark them as not current first if replacing.`,
          existingTenant: existing[0],
        },
        { status: 409 }
      );
    }

    const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();

    const { data, error: insertError } = await supabase
      .from('tenant_lookup')
      .insert({
        name: fullName,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        email: email || null,
        unit_number: unitNumber,
        building_address: buildingAddress,
        status: status || 'Current',
        is_current: true,
        move_in: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting tenant:', insertError);
      return NextResponse.json(
        { success: false, message: 'Failed to add tenant' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Tenant ${fullName} added to ${buildingAddress} Unit ${unitNumber}`,
      tenant: data,
    });

  } catch (error: any) {
    console.error('Add tenant error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to add tenant' },
      { status: 500 }
    );
  }
}
