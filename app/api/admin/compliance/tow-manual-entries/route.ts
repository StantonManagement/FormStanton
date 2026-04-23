import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * GET  — list all active (not towed, not cleared) manual tow entries
 * POST — create a new manual tow entry (free-form or submission-linked)
 */

export async function GET(_request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('tow_manual_entries')
      .select('*')
      .is('towed_at', null)
      .is('cleared_at', null)
      .order('added_at', { ascending: true });

    if (error) {
      console.error('tow-manual-entries GET error:', error);
      return NextResponse.json({ success: false, message: 'Failed to load manual entries' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rows: rows || [] });
  } catch (error: any) {
    console.error('tow-manual-entries GET exception:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to load manual entries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      source,
      linked_submission_id,
      vehicle_plate,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      vehicle_color,
      tenant_name,
      unit_number,
      building_address,
      reason,
      notes,
    } = body;

    if (!source || !['manual', 'submission_search'].includes(source)) {
      return NextResponse.json({ success: false, message: 'Invalid source' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const added_by = sessionUser?.displayName || 'Admin';

    // If linked to a submission, pull vehicle/tenant data from it if not provided
    let resolvedVehiclePlate = vehicle_plate || null;
    let resolvedVehicleMake = vehicle_make || null;
    let resolvedVehicleModel = vehicle_model || null;
    let resolvedVehicleYear = vehicle_year || null;
    let resolvedVehicleColor = vehicle_color || null;
    let resolvedTenantName = tenant_name || null;
    let resolvedUnit = unit_number || null;
    let resolvedBuilding = building_address || null;

    if (source === 'submission_search' && linked_submission_id) {
      const { data: sub } = await supabaseAdmin
        .from('submissions')
        .select('full_name, unit_number, building_address, vehicle_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color')
        .eq('id', linked_submission_id)
        .single();

      if (sub) {
        resolvedVehiclePlate = resolvedVehiclePlate || sub.vehicle_plate;
        resolvedVehicleMake = resolvedVehicleMake || sub.vehicle_make;
        resolvedVehicleModel = resolvedVehicleModel || sub.vehicle_model;
        resolvedVehicleYear = resolvedVehicleYear || sub.vehicle_year;
        resolvedVehicleColor = resolvedVehicleColor || sub.vehicle_color;
        resolvedTenantName = resolvedTenantName || sub.full_name;
        resolvedUnit = resolvedUnit || sub.unit_number;
        resolvedBuilding = resolvedBuilding || sub.building_address;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('tow_manual_entries')
      .insert({
        source,
        linked_submission_id: linked_submission_id || null,
        vehicle_plate: resolvedVehiclePlate,
        vehicle_make: resolvedVehicleMake,
        vehicle_model: resolvedVehicleModel,
        vehicle_year: resolvedVehicleYear,
        vehicle_color: resolvedVehicleColor,
        tenant_name: resolvedTenantName,
        unit_number: resolvedUnit,
        building_address: resolvedBuilding,
        reason: reason || null,
        notes: notes || null,
        added_by,
      })
      .select()
      .single();

    if (error) {
      console.error('tow-manual-entries POST error:', error);
      return NextResponse.json({ success: false, message: 'Failed to create entry' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      'tow.manual_add',
      'tow_manual_entries',
      data.id,
      { source, added_by, vehicle_plate: resolvedVehiclePlate, tenant_name: resolvedTenantName },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('tow-manual-entries POST exception:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to create entry' }, { status: 500 });
  }
}
