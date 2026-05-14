/**
 * GET /api/admin/properties/[address]
 * PUT /api/admin/properties/[address]
 * DELETE /api/admin/properties/[address]
 * 
 * Individual property management endpoints.
 * Address is URL-encoded building address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
// Property config changes are not logged to application_events.
// application_events requires a per-application anchor (anchor_type = 'pbv_full_application').
// Property-level admin actions are covered by the audit_log table if needed.

interface PropertyBody {
  year_built?: number | null;
  required_addenda?: Array<{
    slug: string;
    label: string;
    signing_party: string;
    required: boolean;
    plain_language_description?: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('properties', 'read');
    if (authResult) {
      return authResult;
    }

    const { address } = await params;
    const building_address = decodeURIComponent(address);

    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('building_address', building_address)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      console.error('Failed to fetch property:', error);
      return NextResponse.json({ error: 'Failed to fetch property' }, { status: 500 });
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in GET /api/admin/properties/[address]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
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

    const { address } = await params;
    const building_address = decodeURIComponent(address);
    const body: PropertyBody = await request.json();
    const { year_built, required_addenda } = body;

    // Validate addenda structure if provided
    if (required_addenda) {
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
    }

    // Check if property exists
    const { data: existingProperty } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('building_address', building_address)
      .single();

    if (!existingProperty) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // Update property
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (year_built !== undefined) {
      updateData.year_built = year_built;
    }
    if (required_addenda !== undefined) {
      updateData.required_addenda = required_addenda;
    }

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

    // Write property configuration event
    const fieldsUpdated = [];
    if (year_built !== undefined) fieldsUpdated.push('year_built');
    if (required_addenda !== undefined) fieldsUpdated.push('required_addenda');

    return NextResponse.json({
      success: true,
      property: data
    });

  } catch (error) {
    console.error('Error in PUT /api/admin/properties/[address]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('properties', 'delete');
    if (authResult) {
      return authResult;
    }

    const { address } = await params;
    const building_address = decodeURIComponent(address);

    // Check if property exists
    const { data: existingProperty } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('building_address', building_address)
      .single();

    if (!existingProperty) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // TODO: Check if property is referenced by any applications
    // For now, allow deletion but this should be enhanced in production

    const { error } = await supabaseAdmin
      .from('properties')
      .delete()
      .eq('building_address', building_address);

    if (error) {
      console.error('Failed to delete property:', error);
      return NextResponse.json({ error: 'Failed to delete property' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Property deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/properties/[address]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
