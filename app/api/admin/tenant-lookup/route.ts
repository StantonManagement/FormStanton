import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Normalize address for fuzzy matching
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/street/gi, 'st')
    .replace(/avenue/gi, 'ave')
    .replace(/road/gi, 'rd')
    .replace(/\./g, '');
}

// Normalize unit number for fuzzy matching
function normalizeUnit(unit: string): string {
  return unit
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/unit/gi, '')
    .replace(/#/g, '')
    .replace(/apt/gi, '');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingAddress = searchParams.get('building');
    const unitNumber = searchParams.get('unit');

    if (!buildingAddress || !unitNumber) {
      return NextResponse.json(
        { success: false, message: 'Building address and unit number required' },
        { status: 400 }
      );
    }

    const normalizedInputAddress = normalizeAddress(buildingAddress);
    const normalizedInputUnit = normalizeUnit(unitNumber);

    // Query tenant_lookup table with fuzzy matching
    const { data: tenants, error } = await supabase
      .from('tenant_lookup')
      .select('*')
      .eq('is_current', true);

    if (error) {
      console.error('Error fetching tenants:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch tenant data' },
        { status: 500 }
      );
    }

    // Find matching tenant using fuzzy matching on both address and unit
    const matchingTenant = tenants?.find(tenant => {
      const normalizedTenantAddress = normalizeAddress(tenant.building_address || '');
      const normalizedTenantUnit = normalizeUnit(tenant.unit_number || '');
      
      const addressMatch = normalizedTenantAddress.includes(normalizedInputAddress) ||
                          normalizedInputAddress.includes(normalizedTenantAddress);
      const unitMatch = normalizedTenantUnit === normalizedInputUnit ||
                       normalizedTenantUnit.includes(normalizedInputUnit) ||
                       normalizedInputUnit.includes(normalizedTenantUnit);
      
      return addressMatch && unitMatch;
    });

    if (!matchingTenant) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No current tenant found for this unit',
        input: { building: buildingAddress, unit: unitNumber }
      });
    }

    // Return tenant information
    return NextResponse.json({
      success: true,
      found: true,
      tenant: {
        name: matchingTenant.name || `${matchingTenant.first_name} ${matchingTenant.last_name}`,
        firstName: matchingTenant.first_name,
        lastName: matchingTenant.last_name,
        email: matchingTenant.email,
        unit: matchingTenant.unit_number,
        status: matchingTenant.status
      },
      input: { building: buildingAddress, unit: unitNumber }
    });

  } catch (error: any) {
    console.error('Tenant lookup error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Lookup failed' },
      { status: 500 }
    );
  }
}
