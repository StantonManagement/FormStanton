/**
 * PATCH /api/admin/scheduling/appointments/[id]
 * DELETE /api/admin/scheduling/appointments/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

// PATCH - update appointment status
export async function PATCH(
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
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json(
        { success: false, message: 'Status is required' },
        { status: 400 }
      );
    }

    // Fetch current appointment
    const { data: appointment, error: fetchError } = await supabaseAdmin
      .from('appointments')
      .select('application_id, staff_id, starts_at, purpose, status, notes')
      .eq('id', id)
      .single();

    if (fetchError || !appointment) {
      return NextResponse.json(
        { success: false, message: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Staff can only update their own appointments unless admin
    if (appointment.staff_id !== user.userId && !user.permissions.some(p => p.resource === 'scheduling' && p.action === 'admin')) {
      return NextResponse.json(
        { success: false, message: 'You can only update your own appointments' },
        { status: 403 }
      );
    }

    // Update appointment
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('appointments')
      .update({
        status,
        notes: notes || appointment.notes,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log appropriate event based on status
    let eventType: string | null = null;
    if (status === 'completed') {
      eventType = 'appointment.completed';
    } else if (status === 'no_show') {
      eventType = 'appointment.no_show';
    } else if (status === 'cancelled') {
      eventType = 'appointment.cancelled';
    }

    if (eventType) {
      try {
        const eventPayload: any = {
          appointment_id: id,
          staff_id: user.userId,
          purpose: appointment.purpose,
        };

        if (status === 'completed') {
          eventPayload.completed_at = new Date().toISOString();
          eventPayload.notes = notes;
        } else if (status === 'no_show') {
          eventPayload.scheduled_time = appointment.starts_at;
        } else if (status === 'cancelled') {
          eventPayload.cancelled_at = new Date().toISOString();
          eventPayload.reason = notes;
        }

        await writePbvApplicationEvent({
          applicationId: appointment.application_id,
          eventType: eventType as any,
          actorUserId: user.userId,
          actorDisplayName: user.displayName,
          payload: eventPayload,
        });
      } catch (eventError) {
        console.error('[scheduling/appointments] event log error:', eventError);
      }
    }

    // Audit log
    await logAudit(
      user,
      `scheduling.appointment.${status}`,
      'appointments',
      id,
      { old_status: appointment.status, new_status: status, notes },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[scheduling/appointments] PATCH error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
