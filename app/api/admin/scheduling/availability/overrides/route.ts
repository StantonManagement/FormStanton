/**
 * GET /api/admin/scheduling/availability/overrides
 * POST /api/admin/scheduling/availability/overrides
 * 
 * Manage staff date-specific availability overrides
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

// GET - fetch overrides for a staff member within date range
export async function GET(request: NextRequest) {
  const guard = await requirePermission('scheduling', 'read');
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId') || user.userId;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Staff can only view their own overrides unless they have admin permission
  if (staffId !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
    return NextResponse.json(
      { success: false, message: 'You can only view your own availability' },
      { status: 403 }
    );
  }

  try {
    let query = supabaseAdmin
      .from('staff_availability_overrides')
      .select('*')
      .eq('staff_id', staffId)
      .order('override_date');

    if (startDate) {
      query = query.gte('override_date', startDate);
    }

    if (endDate) {
      query = query.lte('override_date', endDate);
    }

    const { data: overrides, error } = await query;

    if (error) {
      console.error('[scheduling/overrides] GET error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to load availability overrides' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: overrides || [] });
  } catch (error: any) {
    console.error('[scheduling/overrides] GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// POST - create an override
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
      date,
      startTime,
      endTime,
      slotMinutes,
      bufferMinutes,
      reason,
      isClosed,  // If true, startTime/endTime are ignored (day is closed)
    } = body;

    // Validate required fields
    if (!date || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, message: 'Invalid date format (YYYY-MM-DD required)' },
        { status: 400 }
      );
    }

    // Staff can only modify their own overrides unless they have admin permission
    const targetStaffId = staffId || user.userId;
    if (targetStaffId !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
      return NextResponse.json(
        { success: false, message: 'You can only modify your own availability' },
        { status: 403 }
      );
    }

    // Validate time format if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!isClosed) {
      if (!startTime || !timeRegex.test(startTime)) {
        return NextResponse.json(
          { success: false, message: 'Invalid startTime format (HH:MM required)' },
          { status: 400 }
        );
      }
      if (endTime && !timeRegex.test(endTime)) {
        return NextResponse.json(
          { success: false, message: 'Invalid endTime format (HH:MM required)' },
          { status: 400 }
        );
      }
    }

    // Check if override already exists for this date
    const { data: existing } = await supabaseAdmin
      .from('staff_availability_overrides')
      .select('id')
      .eq('staff_id', targetStaffId)
      .eq('override_date', date)
      .maybeSingle();

    let result;
    const insertData = {
      staff_id: targetStaffId,
      override_date: date,
      start_time: isClosed ? null : startTime,
      end_time: isClosed ? null : (endTime || null),
      slot_minutes: slotMinutes || null,
      buffer_minutes: bufferMinutes || null,
      reason: reason || (isClosed ? 'Closed' : 'Modified hours'),
    };

    if (existing) {
      // Update existing
      const { data, error } = await supabaseAdmin
        .from('staff_availability_overrides')
        .update(insertData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Create new
      const { data, error } = await supabaseAdmin
        .from('staff_availability_overrides')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Audit log
    await logAudit(
      user,
      existing ? 'scheduling.override.updated' : 'scheduling.override.created',
      'staff_availability_overrides',
      result.id,
      {
        staff_id: targetStaffId,
        date,
        is_closed: isClosed,
        start_time: insertData.start_time,
        end_time: insertData.end_time,
        reason: insertData.reason,
      },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[scheduling/overrides] POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// DELETE - remove an override (requires override ID in body)
export async function DELETE(request: NextRequest) {
  const guard = await requirePermission('scheduling', 'write');
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const overrideId = searchParams.get('id');

    if (!overrideId) {
      return NextResponse.json(
        { success: false, message: 'Override ID is required' },
        { status: 400 }
      );
    }

    // Get the override to check ownership
    const { data: override } = await supabaseAdmin
      .from('staff_availability_overrides')
      .select('staff_id, override_date')
      .eq('id', overrideId)
      .single();

    if (!override) {
      return NextResponse.json(
        { success: false, message: 'Override not found' },
        { status: 404 }
      );
    }

    // Staff can only delete their own overrides unless they have admin permission
    if (override.staff_id !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
      return NextResponse.json(
        { success: false, message: 'You can only delete your own overrides' },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('staff_availability_overrides')
      .delete()
      .eq('id', overrideId);

    if (error) throw error;

    // Audit log
    await logAudit(
      user,
      'scheduling.override.deleted',
      'staff_availability_overrides',
      overrideId,
      {
        staff_id: override.staff_id,
        date: override.override_date,
      },
      getClientIp(request)
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[scheduling/overrides] DELETE error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
