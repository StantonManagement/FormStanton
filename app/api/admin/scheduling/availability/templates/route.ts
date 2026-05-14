/**
 * GET /api/admin/scheduling/availability/templates
 * POST /api/admin/scheduling/availability/templates
 * 
 * Manage staff weekly availability templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

// GET - fetch templates for a staff member
export async function GET(request: NextRequest) {
  const guard = await requirePermission('scheduling', 'read');
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId') || user.userId;

  // Staff can only view their own templates unless they have admin permission
  if (staffId !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
    return NextResponse.json(
      { success: false, message: 'You can only view your own availability' },
      { status: 403 }
    );
  }

  try {
    const { data: templates, error } = await supabaseAdmin
      .from('staff_availability_templates')
      .select('*')
      .eq('staff_id', staffId)
      .order('weekday');

    if (error) {
      console.error('[scheduling/templates] GET error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to load availability templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: templates || [] });
  } catch (error: any) {
    console.error('[scheduling/templates] GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST - create or update a template
export async function POST(request: NextRequest) {
  const guard = await requirePermission('scheduling', 'write');
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      staffId,
      weekday,
      startTime,
      endTime,
      slotMinutes = 30,
      bufferMinutes = 0,
      isActive = true,
    } = body;

    // Validate required fields
    if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
      return NextResponse.json(
        { success: false, message: 'Invalid weekday (0-6 required)' },
        { status: 400 }
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, message: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json(
        { success: false, message: 'Invalid time format (HH:MM required)' },
        { status: 400 }
      );
    }

    // Staff can only modify their own templates unless they have admin permission
    const targetStaffId = staffId || user.userId;
    if (targetStaffId !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
      return NextResponse.json(
        { success: false, message: 'You can only modify your own availability' },
        { status: 403 }
      );
    }

    // Check if template already exists for this staff/weekday
    const { data: existing } = await supabaseAdmin
      .from('staff_availability_templates')
      .select('id')
      .eq('staff_id', targetStaffId)
      .eq('weekday', weekday)
      .maybeSingle();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('staff_availability_templates')
        .update({
          start_time: startTime,
          end_time: endTime,
          slot_minutes: slotMinutes,
          buffer_minutes: bufferMinutes,
          is_active: isActive,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('staff_availability_templates')
        .insert({
          staff_id: targetStaffId,
          weekday,
          start_time: startTime,
          end_time: endTime,
          slot_minutes: slotMinutes,
          buffer_minutes: bufferMinutes,
          is_active: isActive,
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Audit log
    await logAudit(
      user,
      existing ? 'scheduling.template.updated' : 'scheduling.template.created',
      'staff_availability_templates',
      result.id,
      {
        staff_id: targetStaffId,
        weekday,
        start_time: startTime,
        end_time: endTime,
        is_active: isActive,
      },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[scheduling/templates] POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
