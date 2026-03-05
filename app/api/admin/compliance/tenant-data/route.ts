import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthenticated } from '@/lib/auth';
import { normalizeAddress } from '@/lib/addressNormalizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TenantData {
  unit_number: string;
  tenant_name: string;
  email: string;
  phone: string;
  building_address: string;
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all current tenants from tenant_lookup table
    const { data: tenants, error } = await supabase
      .from('tenant_lookup')
      .select('name, first_name, last_name, email, phone, unit_number, building_address')
      .eq('is_current', true);

    if (error) {
      console.error('Error fetching tenant data:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch tenant data' },
        { status: 500 }
      );
    }

    // Group tenants by normalized building address
    const buildingMap = new Map<string, TenantData[]>();

    tenants?.forEach(tenant => {
      const normalizedBuilding = normalizeAddress(tenant.building_address || '');
      const tenantData: TenantData = {
        unit_number: tenant.unit_number || '',
        tenant_name: tenant.name || `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim(),
        email: tenant.email || '',
        phone: tenant.phone || '',
        building_address: tenant.building_address || '',
      };

      if (!buildingMap.has(normalizedBuilding)) {
        buildingMap.set(normalizedBuilding, []);
      }
      buildingMap.get(normalizedBuilding)!.push(tenantData);
    });

    // Convert map to array format
    const buildingData = Array.from(buildingMap.entries()).map(([normalizedAddress, tenants]) => ({
      building_address_normalized: normalizedAddress,
      building_address_original: tenants[0]?.building_address || normalizedAddress,
      occupied_units: tenants,
      occupied_count: tenants.length,
    }));

    return NextResponse.json({
      success: true,
      data: buildingData,
      total_tenants: tenants?.length || 0,
    });

  } catch (error: any) {
    console.error('Tenant data fetch error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch tenant data' },
      { status: 500 }
    );
  }
}
