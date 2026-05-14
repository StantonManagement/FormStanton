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
// Property config changes are not logged to application_events.
// application_events requires a per-application anchor (anchor_type = 'pbv_full_application').
// Property-level admin actions are covered by the audit_log table if needed.

interface PropertyBody {
  address: string;
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
    const address = searchParams.get('address');

    let query = supabaseAdmin
      .from('properties')
      .select('*')
      .order('address');

    if (address) {
      query = query.eq('address', address);
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
    const { address, year_built, required_addenda = [] } = body;

    if (!address) {
      return NextResponse.json(
        { error: 'address is required' },
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
      .eq('address', address)
      .single();

    let property;

    if (existingProperty) {
      // Update existing property
      const updateData: any = {};
      if (year_built !== undefined) {
        updateData.year_built = year_built;
      }
      updateData.required_addenda = required_addenda;
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('properties')
        .update(updateData)
        .eq('address', address)
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
          address,
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
