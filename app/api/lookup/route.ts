import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const building = searchParams.get('building');
    const unit = searchParams.get('unit');

    // Search by building + unit
    if (building && unit) {
      // Search submissions table
      const { data: submissions, error: submissionsError } = await supabaseAdmin
        .from('submissions')
        .select('full_name, phone, email, building_address, unit_number')
        .eq('building_address', building)
        .eq('unit_number', unit)
        .not('full_name', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (submissionsError) {
        console.error('Submissions search error:', submissionsError);
      }

      // Search tenant_lookup table
      const { data: tenants, error: tenantsError } = await supabaseAdmin
        .from('tenant_lookup')
        .select('name, first_name, last_name, email, building_address, unit_number')
        .eq('building_address', building)
        .eq('unit_number', unit)
        .eq('is_current', true)
        .limit(10);

      if (tenantsError && tenantsError.code !== 'PGRST116') {
        console.error('Tenant lookup search error:', tenantsError);
      }

      // Combine and deduplicate results
      const results = new Map();

      // Add submissions
      submissions?.forEach(sub => {
        const key = `${sub.full_name}-${sub.building_address}-${sub.unit_number}`;
        if (!results.has(key)) {
          results.set(key, {
            full_name: sub.full_name,
            phone: sub.phone || '',
            email: sub.email || '',
            building_address: sub.building_address,
            unit_number: sub.unit_number,
          });
        }
      });

      // Add tenant_lookup results
      tenants?.forEach(tenant => {
        const fullName = tenant.name || `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim();
        const key = `${fullName}-${tenant.building_address}-${tenant.unit_number}`;
        if (!results.has(key) && fullName) {
          results.set(key, {
            full_name: fullName,
            phone: '',
            email: tenant.email || '',
            building_address: tenant.building_address,
            unit_number: tenant.unit_number,
          });
        }
      });

      return NextResponse.json({
        success: true,
        results: Array.from(results.values()),
      });
    }

    // Search by name (existing functionality)
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        results: [],
      });
    }

    const searchTerm = `%${query.trim()}%`;

    // Search submissions table for matching names
    const { data: submissions, error: submissionsError } = await supabaseAdmin
      .from('submissions')
      .select('full_name, phone, email, building_address, unit_number')
      .ilike('full_name', searchTerm)
      .not('full_name', 'is', null)
      .not('phone', 'is', null)
      .not('building_address', 'is', null)
      .not('unit_number', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (submissionsError) {
      console.error('Submissions search error:', submissionsError);
    }

    // Search tenant_lookup table if it exists
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenant_lookup')
      .select('name, first_name, last_name, email, building_address, unit_number')
      .or(`name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`)
      .eq('is_current', true)
      .limit(10);

    if (tenantsError && tenantsError.code !== 'PGRST116') {
      console.error('Tenant lookup search error:', tenantsError);
    }

    // Combine and deduplicate results
    const results = new Map();

    // Add submissions
    submissions?.forEach(sub => {
      const key = `${sub.full_name}-${sub.building_address}-${sub.unit_number}`;
      if (!results.has(key)) {
        results.set(key, {
          full_name: sub.full_name,
          phone: sub.phone || '',
          email: sub.email || '',
          building_address: sub.building_address,
          unit_number: sub.unit_number,
        });
      }
    });

    // Add tenant_lookup results
    tenants?.forEach(tenant => {
      const fullName = tenant.name || `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim();
      const key = `${fullName}-${tenant.building_address}-${tenant.unit_number}`;
      if (!results.has(key) && fullName) {
        results.set(key, {
          full_name: fullName,
          phone: '',
          email: tenant.email || '',
          building_address: tenant.building_address,
          unit_number: tenant.unit_number,
        });
      }
    });

    return NextResponse.json({
      success: true,
      results: Array.from(results.values()).slice(0, 10),
    });

  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Search failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { buildingAddress, unitNumber } = await request.json();

    if (!buildingAddress || !unitNumber) {
      return NextResponse.json(
        { success: false, message: 'Building address and unit number are required' },
        { status: 400 }
      );
    }

    const { data: submission, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('building_address', buildingAddress)
      .eq('unit_number', unitNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !submission) {
      // No submission row — check tenant_lookup (canonical source) and auto-create
      const { data: tenantRow } = await supabaseAdmin
        .from('tenant_lookup')
        .select('name, first_name, last_name')
        .eq('building_address', buildingAddress)
        .eq('unit_number', unitNumber)
        .eq('is_current', true)
        .not('first_name', 'is', null)
        .neq('name', 'Occupied Unit')
        .order('id', { ascending: true })
        .limit(1)
        .single();

      if (!tenantRow) {
        return NextResponse.json(
          { success: false, message: 'No matching submission found' },
          { status: 404 }
        );
      }

      const fullName = tenantRow.name ||
        `${tenantRow.first_name || ''} ${tenantRow.last_name || ''}`.trim();

      const { data: created, error: createError } = await supabaseAdmin
        .from('submissions')
        .insert({
          full_name: fullName,
          building_address: buildingAddress,
          unit_number: unitNumber,
          has_pets: false,
          has_vehicle: false,
          has_insurance: false,
          add_insurance_to_rent: false,
          insurance_upload_pending: true,
          language: 'en',
        })
        .select()
        .single();

      if (createError || !created) {
        console.error('Failed to create submission for tenant_lookup match:', createError);
        return NextResponse.json(
          { success: false, message: 'No matching submission found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        submission: {
          id: created.id,
          fullName: created.full_name,
          hasInsurance: false,
          insuranceProvider: null,
          insurancePolicyNumber: null,
          insuranceUploadPending: true,
          hasInsuranceFile: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        fullName: submission.full_name,
        hasInsurance: submission.has_insurance,
        insuranceProvider: submission.insurance_provider,
        insurancePolicyNumber: submission.insurance_policy_number,
        insuranceUploadPending: submission.insurance_upload_pending,
        hasInsuranceFile: !!submission.insurance_file,
      },
    });

  } catch (error: any) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Lookup failed' },
      { status: 500 }
    );
  }
}
