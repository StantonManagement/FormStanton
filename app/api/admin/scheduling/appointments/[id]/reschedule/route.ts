/**
 * POST /api/admin/scheduling/appointments/[id]/reschedule
 * 
 * Reschedule an appointment to a new slot
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent } from '@/lib/events/application-events';
import { getAvailableSlots } from '@/lib/scheduling/slots';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission('scheduling', 'write');
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { newStaffId, newStartTime, reason } = body;

    if (!newStaffId || !newStartTime) {
      return NextResponse.json(
        { success: false, message: 'newStaffId and newStartTime are required' },
        { status: 400 }
      );
    }

    const slotStart = new Date(newStartTime);
    if (isNaN(slotStart.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid newStartTime' },
        { status: 400 }
      );
    }

    // Fetch current appointment
    const { data: appointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('application_id, staff_id, starts_at, duration_minutes, purpose, status, notes')
      .eq('id', id)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json(
        { success: false, message: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Staff can only reschedule their own appointments unless admin
    if (appointment.staff_id !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
      return NextResponse.json(
        { success: false, message: 'You can only reschedule your own appointments' },
        { status: 403 }
      );
    }

    // Verify new slot is available
    const slotDate = new Date(slotStart);
    slotDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(slotDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const availableSlots = await getAvailableSlots({
      staffId: newStaffId,
      startDate: slotDate,
      endDate: nextDay,
      minLeadTimeHours: 0, // Allow rescheduling to near-term slots
    });

    const slotStillAvailable = availableSlots.some(
      slot => Math.abs(slot.startTime.getTime() - slotStart.getTime()) < 60000
    );

    if (!slotStillAvailable) {
      return NextResponse.json(
        { success: false, message: 'This slot is no longer available. Please select another time.' },
        { status: 409 }
      );
    }

    // Find the slot to get duration
    const selectedSlot = availableSlots.find(
      slot => Math.abs(slot.startTime.getTime() - slotStart.getTime()) < 60000
    );
    const durationMinutes = selectedSlot?.durationMinutes || appointment.duration_minutes;

    // Mark old appointment as rescheduled
    const { error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'rescheduled' })
      .eq('id', id);

    if (updateError) throw updateError;

    // Create new appointment
    const { data: newAppointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        application_id: appointment.application_id,
        staff_id: newStaffId,
        starts_at: slotStart.toISOString(),
        duration_minutes: durationMinutes,
        purpose: appointment.purpose,
        status: 'scheduled',
        rescheduled_from_id: id,
        created_by: user.userId,
        notes: reason || `Rescheduled from ${new Date(appointment.starts_at).toLocaleString()}`,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log rescheduled event
    try {
      await writePbvApplicationEvent({
        applicationId: appointment.application_id,
        eventType: 'appointment.rescheduled',
        actorUserId: user.userId,
        actorDisplayName: user.displayName,
        payload: {
          old_appointment_id: id,
          new_appointment_id: newAppointment.id,
          new_starts_at: slotStart.toISOString(),
          reason: reason || 'Staff rescheduled',
        },
      });
    } catch (eventError) {
      console.error('[scheduling/reschedule] event log error:', eventError);
    }

    // Audit log
    await logAudit(
      user,
      'scheduling.appointment.rescheduled',
      'appointments',
      id,
      {
        old_appointment_id: id,
        new_appointment_id: newAppointment.id,
        new_start_time: slotStart.toISOString(),
        reason,
      },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        oldAppointmentId: id,
        newAppointment: newAppointment,
      },
    });
  } catch (error: any) {
    console.error('[scheduling/reschedule] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
