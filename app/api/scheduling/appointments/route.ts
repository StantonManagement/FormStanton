/**
 * POST /api/scheduling/appointments
 * 
 * Create an appointment from tenant scheduling link
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';
import { getAvailableSlots } from '@/lib/scheduling/slots';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      token,
      staffId,
      startTime,
      purpose = 'sign_documents',
      notes,
    } = body;

    if (!token || !staffId || !startTime) {
      return NextResponse.json(
        { success: false, message: 'Token, staffId, and startTime are required' },
        { status: 400 }
      );
    }

    const slotStart = new Date(startTime);
    if (isNaN(slotStart.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid startTime' },
        { status: 400 }
      );
    }

    // Validate token and get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, preferred_language, tenant_phone')
      .eq('tenant_access_token', token)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Verify slot is still available
    const slotDate = new Date(slotStart);
    slotDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(slotDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const availableSlots = await getAvailableSlots({
      staffId,
      startDate: slotDate,
      endDate: nextDay,
      minLeadTimeHours: 24,
    });

    const slotStillAvailable = availableSlots.some(
      slot => Math.abs(slot.startTime.getTime() - slotStart.getTime()) < 60000 // Within 1 minute
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

    const durationMinutes = selectedSlot?.durationMinutes || 30;
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

    // Get staff info
    const { data: staff } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name')
      .eq('id', staffId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: 'Selected staff not found' },
        { status: 400 }
      );
    }

    // Create the appointment
    const { data: appointment, error: insertError } = await supabaseAdmin
      .from('appointments')
      .insert({
        application_id: application.id,
        staff_id: staffId,
        starts_at: slotStart.toISOString(),
        duration_minutes: durationMinutes,
        purpose,
        status: 'scheduled',
        tenant_confirmed_at: new Date().toISOString(),
        created_by: null, // Tenant self-scheduled
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[scheduling/appointments] insert error:', insertError);
      return NextResponse.json(
        { success: false, message: 'Failed to create appointment' },
        { status: 500 }
      );
    }

    // Log application event
    try {
      await writePbvApplicationEvent({
        applicationId: application.id,
        eventType: 'appointment.scheduled',
        actorUserId: null, // Tenant self-scheduled
        actorDisplayName: application.head_of_household_name,
        payload: {
          appointment_id: appointment.id,
          staff_id: staffId,
          staff_name: staff.display_name,
          starts_at: slotStart.toISOString(),
          purpose,
          self_scheduled: true,
        },
      });
    } catch (eventError) {
      // Non-fatal - don't fail the appointment creation
      console.error('[scheduling/appointments] event log error:', eventError);
    }

    return NextResponse.json({
      success: true,
      data: {
        appointment: {
          id: appointment.id,
          startsAt: appointment.starts_at,
          endsAt: slotEnd.toISOString(),
          durationMinutes,
          purpose,
          staffName: staff.display_name,
        },
        tenant: {
          name: application.head_of_household_name,
          preferredLanguage: application.preferred_language,
        },
      },
    });
  } catch (error: any) {
    console.error('[scheduling/appointments] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
