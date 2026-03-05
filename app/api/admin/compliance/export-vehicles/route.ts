import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingAddress = searchParams.get('building');
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';

    let query = supabase
      .from('submissions')
      .select('*')
      .eq('has_vehicle', true)
      .order('building_address', { ascending: true })
      .order('unit_number', { ascending: true });

    if (buildingAddress && buildingAddress !== 'all') {
      query = query.eq('building_address', buildingAddress);
    }

    if (verifiedOnly) {
      query = query.eq('vehicle_verified', true);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch vehicle data' },
        { status: 500 }
      );
    }

    // Generate CSV
    const csvRows: string[] = [];
    
    // Header
    csvRows.push([
      'Building Address',
      'Unit Number',
      'Tenant Name',
      'Phone',
      'Email',
      'Vehicle Make',
      'Vehicle Model',
      'Vehicle Year',
      'Vehicle Color',
      'License Plate',
      'Additional Vehicles',
      'Verified',
      'Submission Date'
    ].join(','));

    // Data rows
    for (const sub of submissions) {
      const additionalVehicles = sub.additional_vehicles 
        ? (sub.additional_vehicles as any[]).map(v => 
            `${v.vehicle_year} ${v.vehicle_make} ${v.vehicle_model} (${v.vehicle_plate})`
          ).join('; ')
        : '';

      csvRows.push([
        `"${sub.building_address || ''}"`,
        `"${sub.unit_number || ''}"`,
        `"${sub.full_name || ''}"`,
        `"${sub.phone || ''}"`,
        `"${sub.email || ''}"`,
        `"${sub.vehicle_make || ''}"`,
        `"${sub.vehicle_model || ''}"`,
        `"${sub.vehicle_year || ''}"`,
        `"${sub.vehicle_color || ''}"`,
        `"${sub.vehicle_plate || ''}"`,
        `"${additionalVehicles}"`,
        sub.vehicle_verified ? 'Yes' : 'No',
        `"${new Date(sub.created_at).toLocaleDateString()}"`
      ].join(','));
    }

    const csvContent = csvRows.join('\n');
    const filename = buildingAddress && buildingAddress !== 'all' 
      ? `vehicles_${buildingAddress.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`
      : `vehicles_all_buildings_${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Vehicle export error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to export vehicles' },
      { status: 500 }
    );
  }
}
