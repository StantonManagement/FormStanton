/**
 * GET /api/admin/properties
 * POST /api/admin/properties
 * 
 * Properties management for the signing packet system.
 * GET returns all properties with their configuration.
 * POST creates or updates a property configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
// TODO(property_configured): PROPERTY_CONFIGURED events need a 'system' anchor type
// added to application_events before property config changes can be logged.
// Removed stale writeApplicationEvent call with fullApplicationId: 'system' (non-UUID).

interface PropertyBody {
  building_address: string;
  year_built?: number | null;
  required_addenda?: Array<{
    slug: string;
    label: string;
    signing_party: string;
    required: boolean;
    plain_language_description?: string;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('properties', 'read');
    if (authResult) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const building_address = searchParams.get('building_address');

    let query = supabaseAdmin
      .from('properties')
      .select('*')
      .order('building_address');

    if (building_address) {
      query = query.eq('building_address', building_address);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch properties:', error);
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }

    return NextResponse.json({ properties: data || [] });

  } catch (error) {
    console.error('Error in GET /api/admin/properties:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('properties', 'write');
    if (authResult) {
      return authResult;
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PropertyBody = await request.json();
    const { building_address, year_built, required_addenda = [] } = body;

    if (!building_address) {
      return NextResponse.json(
        { error: 'building_address is required' },
        { status: 400 }
      );
    }

    // Validate addenda structure
    for (const addendum of required_addenda) {
      if (!addendum.slug || !addendum.label || !addendum.signing_party) {
        return NextResponse.json(
          { error: 'Each addendum must have slug, label, and signing_party' },
          { status: 400 }
        );
      }

      const validParties = ['tenant', 'stanton', 'hach', 'tenant_and_stanton', 'stanton_and_hach'];
      if (!validParties.includes(addendum.signing_party)) {
        return NextResponse.json(
          { error: `Invalid signing_party: ${addendum.signing_party}` },
          { status: 400 }
        );
      }
    }

    // Check if property exists
    const { data: existingProperty } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('building_address', building_address)
      .single();

    let property;
    const fieldsUpdated: string[] = [];

    if (existingProperty) {
      // Update existing property
      const updateData: any = {};
      if (year_built !== undefined) {
        updateData.year_built = year_built;
        fieldsUpdated.push('year_built');
      }
      if (required_addenda.length > 0) {
        updateData.required_addenda = required_addenda;
        fieldsUpdated.push('required_addenda');
      }
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('properties')
        .update(updateData)
        .eq('building_address', building_address)
        .select()
        .single();

      if (error) {
        console.error('Failed to update property:', error);
        return NextResponse.json({ error: 'Failed to update property' }, { status: 500 });
      }

      property = data;
    } else {
      // Create new property
      const { data, error } = await supabaseAdmin
        .from('properties')
        .insert({
          building_address,
          year_built,
          required_addenda,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create property:', error);
        return NextResponse.json({ error: 'Failed to create property' }, { status: 500 });
      }

      property = data;
      fieldsUpdated.push('created');
    }


    return NextResponse.json({
      success: true,
      property,
      action: existingProperty ? 'updated' : 'created'
    });

  } catch (error) {
    console.error('Error in POST /api/admin/properties:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
