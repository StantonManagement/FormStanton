import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthenticated } from '@/lib/auth';
import { buildingToAssetId } from '@/lib/buildingAssetIds';
import { normalizeAddress } from '@/lib/addressNormalizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const buildingAddress = searchParams.get('building');
    const buildingsParam = searchParams.get('buildings'); // comma-separated list
    const verifiedOnly = searchParams.get('verifiedOnly') === 'true';
    const grouped = searchParams.get('grouped') === 'true';
    const adminName = searchParams.get('admin') || 'Admin';

    let query = supabase
      .from('submissions')
      .select('*')
      .eq('has_vehicle', true)
      .order('building_address', { ascending: true })
      .order('unit_number', { ascending: true });

    let selectedNormalizedBuildings: Set<string> | null = null;

    if (buildingsParam) {
      // Multi-building export — always verified only
      const buildingList = buildingsParam.split(',').map(b => b.trim()).filter(Boolean);
      selectedNormalizedBuildings = new Set(buildingList.map(normalizeAddress));
      query = query.eq('vehicle_verified', true);
    } else if (buildingAddress && buildingAddress !== 'all') {
      selectedNormalizedBuildings = new Set([normalizeAddress(buildingAddress)]);
      if (verifiedOnly) {
        query = query.eq('vehicle_verified', true);
      }
    } else if (verifiedOnly) {
      query = query.eq('vehicle_verified', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch vehicle data' },
        { status: 500 }
      );
    }

    const submissions = selectedNormalizedBuildings
      ? (data || []).filter((sub) => selectedNormalizedBuildings!.has(normalizeAddress(sub.building_address || '')))
      : (data || []);

    // Mark all exported submissions
    if (submissions.length > 0) {
      const submissionIds = submissions.map(s => s.id);
      const now = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          vehicle_exported: true,
          vehicle_exported_at: now,
          vehicle_exported_by: adminName
        })
        .in('id', submissionIds);

      if (updateError) {
        console.error('Error marking submissions as exported:', updateError);
        return NextResponse.json(
          { success: false, message: 'Failed to mark exported vehicles' },
          { status: 500 }
        );
      }
    }

    // Generate CSV
    const csvRows: string[] = [];
    const useGrouped = grouped || !!buildingsParam;

    if (useGrouped) {
      // Grouped CSV: building separator rows with per-building headers
      const byBuilding: Record<string, typeof submissions> = {};
      for (const sub of submissions) {
        const addr = sub.building_address || 'Unknown';
        if (!byBuilding[addr]) byBuilding[addr] = [];
        byBuilding[addr].push(sub);
      }

      const buildingAddresses = Object.keys(byBuilding).sort();
      for (const addr of buildingAddresses) {
        const assetId = buildingToAssetId[addr] || '';
        csvRows.push(`"--- ${addr}${assetId ? ` (${assetId})` : ''} ---"`);
        csvRows.push('Unit,Tenant,Phone,Make,Model,Year,Color,Plate,Additional Vehicles');

        for (const sub of byBuilding[addr]) {
          const additionalVehicles = sub.additional_vehicles
            ? (sub.additional_vehicles as any[]).map((v: any) =>
                `${v.vehicle_year} ${v.vehicle_make} ${v.vehicle_model} (${(v.vehicle_plate || '').toUpperCase()})`
              ).join('; ')
            : '';

          csvRows.push([
            `"${sub.unit_number || ''}"`,
            `"${sub.full_name || ''}"`,
            `"${sub.phone || ''}"`,
            `"${sub.vehicle_make || ''}"`,
            `"${sub.vehicle_model || ''}"`,
            `"${sub.vehicle_year || ''}"`,
            `"${sub.vehicle_color || ''}"`,
            `"${(sub.vehicle_plate || '').toUpperCase()}"`,
            `"${additionalVehicles}"`,
          ].join(','));
        }
        csvRows.push(''); // blank line between buildings
      }
    } else {
      // Flat CSV (legacy single-building export)
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

      for (const sub of submissions) {
        const additionalVehicles = sub.additional_vehicles
          ? (sub.additional_vehicles as any[]).map((v: any) =>
              `${v.vehicle_year} ${v.vehicle_make} ${v.vehicle_model} (${(v.vehicle_plate || '').toUpperCase()})`
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
          `"${(sub.vehicle_plate || '').toUpperCase()}"`,
          `"${additionalVehicles}"`,
          sub.vehicle_verified ? 'Yes' : 'No',
          `"${new Date(sub.created_at).toLocaleDateString()}"`
        ].join(','));
      }
    }

    const csvContent = csvRows.join('\n');
    const dateStr = new Date().toISOString().split('T')[0];
    let filename: string;
    if (buildingsParam) {
      const count = buildingsParam.split(',').filter(Boolean).length;
      filename = `vehicles_${count}_buildings_${dateStr}.csv`;
    } else if (buildingAddress && buildingAddress !== 'all') {
      filename = `vehicles_${buildingAddress.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.csv`;
    } else {
      filename = `vehicles_all_buildings_${dateStr}.csv`;
    }

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
