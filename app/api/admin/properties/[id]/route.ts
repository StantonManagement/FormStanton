/**
 * GET /api/admin/properties/[id]
 * PATCH /api/admin/properties/[id]
 * 
 * Individual property management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  try {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, message: 'Property not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, property: data });

  } catch (error: any) {
    console.error('[properties/[id] GET] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { year_built, required_addenda } = body;

    // Get current property
    const { data: currentProperty, error: fetchError } = await supabaseAdmin
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentProperty) {
      return NextResponse.json(
        { success: false, message: 'Property not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    const fieldsUpdated: string[] = [];

    if (year_built !== undefined) {
      updateData.year_built = year_built;
      fieldsUpdated.push('year_built');
    }

    if (required_addenda !== undefined) {
      updateData.required_addenda = required_addenda;
      fieldsUpdated.push('required_addenda');
    }

    // Update property
    const { data: property, error: updateError } = await supabaseAdmin
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update property: ${updateError.message}`);
    }

    // Write property_configured event for each application at this building
    // This helps trigger updates in the signing surfaces
    const { data: applications } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('building_address', currentProperty.address);

    for (const app of (applications || [])) {
      await writePbvApplicationEvent({
        applicationId: app.id,
        eventType: 'property_configured',
        actorUserId: user.userId,
        actorDisplayName: user.displayName,
        payload: {
          building_address: currentProperty.address,
          fields_updated: fieldsUpdated,
        },
      });
    }

    return NextResponse.json({
      success: true,
      property,
      fields_updated: fieldsUpdated,
    });

  } catch (error: any) {
    console.error('[properties/[id] PATCH] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
