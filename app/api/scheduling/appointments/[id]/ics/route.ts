/**
 * GET /api/scheduling/appointments/[id]/ics
 * 
 * Download ICS calendar file for an appointment
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateAppointmentICS } from '@/lib/scheduling/ics';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch appointment with related data
    const { data: appointment, error } = await supabaseAdmin
      .from('appointments')
      .select(`
        id,
        starts_at,
        duration_minutes,
        purpose,
        application_id,
        staff_id,
        admin_users:staff_id (display_name)
      `)
      .eq('id', id)
      .single();

    if (error || !appointment) {
      return NextResponse.json(
        { success: false, message: 'Appointment not found' },
        { status: 404 }
      );
    }

    // Fetch application data for tenant info
    const { data: application } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('head_of_household_name, tenant_email')
      .eq('id', appointment.application_id)
      .single();

    const staffName = (appointment.admin_users as any)?.display_name || 'Stanton Staff';
    const tenantName = application?.head_of_household_name || 'Tenant';
    const tenantEmail = application?.tenant_email;

    const startTime = new Date(appointment.starts_at);
    const endTime = new Date(startTime.getTime() + appointment.duration_minutes * 60 * 1000);

    const { filename, content, contentType } = generateAppointmentICS(
      appointment.id,
      appointment.purpose,
      startTime,
      endTime,
      staffName,
      tenantName,
      tenantEmail || undefined
    );

    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[scheduling/ics] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
