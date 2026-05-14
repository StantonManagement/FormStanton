/**
 * GET /api/admin/scheduling/appointments?date=YYYY-MM-DD&staffId=xxx
 * PATCH /api/admin/scheduling/appointments/[id] - update status
 * POST /api/admin/scheduling/appointments/[id]/reschedule
 * 
 * Staff appointment management endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { writePbvApplicationEvent } from '@/lib/events/application-events';

// GET appointments for a date
export async function GET(request: NextRequest) {
  const guard = await requirePermission('scheduling', 'read');
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const staffId = searchParams.get('staffId');
  const myOnly = searchParams.get('myOnly') === 'true';

  if (!dateStr) {
    return NextResponse.json(
      { success: false, message: 'Date is required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  try {
    // Build query for appointments on this date
    const startOfDay = new Date(dateStr + 'T00:00:00Z');
    const endOfDay = new Date(dateStr + 'T23:59:59Z');

    let query = supabaseAdmin
      .from('appointments')
      .select(`
        id,
        application_id,
        staff_id,
        starts_at,
        duration_minutes,
        purpose,
        status,
        notes,
        rescheduled_from_id,
        admin_users:staff_id (display_name, username),
        pbv_full_applications:application_id (
          head_of_household_name,
          unit_number,
          building_address,
          tenant_phone
        )
      `)
      .gte('starts_at', startOfDay.toISOString())
      .lte('starts_at', endOfDay.toISOString())
      .not('status', 'in', '(cancelled,rescheduled)')
      .order('starts_at');

    // Filter by staff if specified
    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    // If user only wants to see their own appointments
    if (myOnly) {
      query = query.eq('staff_id', user.userId);
    }

    const { data: appointments, error } = await query;

    if (error) {
      console.error('[scheduling/appointments] GET error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to load appointments' },
        { status: 500 }
      );
    }

    // Fetch unsigned documents for each application (for context)
    const applicationIds = [...new Set(appointments?.map(a => a.application_id) || [])];
    const unsignedDocsByApp: Record<string, Array<{ label: string; doc_type: string }>> = {};

    if (applicationIds.length > 0) {
      const { data: docs } = await supabaseAdmin
        .from('application_documents')
        .select('anchor_id, label, doc_type, requires_signature, status')
        .eq('anchor_type', 'pbv_full_application')
        .in('anchor_id', applicationIds)
        .eq('requires_signature', true)
        .not('status', 'in', '(approved,waived)');

      for (const doc of docs || []) {
        if (!unsignedDocsByApp[doc.anchor_id]) {
          unsignedDocsByApp[doc.anchor_id] = [];
        }
        unsignedDocsByApp[doc.anchor_id].push({
          label: doc.label,
          doc_type: doc.doc_type,
        });
      }
    }

    // Format response
    const formattedAppointments = (appointments || []).map(appt => ({
      id: appt.id,
      startsAt: appt.starts_at,
      durationMinutes: appt.duration_minutes,
      purpose: appt.purpose,
      status: appt.status,
      notes: appt.notes,
      rescheduledFromId: appt.rescheduled_from_id,
      staff: {
        id: appt.staff_id,
        name: (appt.admin_users as any)?.display_name || 'Unknown',
      },
      tenant: {
        name: (appt.pbv_full_applications as any)?.head_of_household_name || 'Unknown',
        unit: (appt.pbv_full_applications as any)?.unit_number,
        building: (appt.pbv_full_applications as any)?.building_address,
        phone: (appt.pbv_full_applications as any)?.tenant_phone,
      },
      unsignedDocuments: unsignedDocsByApp[appt.application_id] || [],
    }));

    return NextResponse.json({
      success: true,
      data: formattedAppointments,
    });
  } catch (error: any) {
    console.error('[scheduling/appointments] GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
