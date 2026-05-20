/**
 * GET /api/scheduling/slots?token=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD
 * 
 * Get available appointment slots for a tenant using their magic link token
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAvailableSlots } from '@/lib/scheduling/slots';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const startDateStr = searchParams.get('start');
  const endDateStr = searchParams.get('end');

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'Token is required' },
      { status: 400 }
    );
  }

  // Validate dates
  if (!startDateStr || !endDateStr) {
    return NextResponse.json(
      { success: false, message: 'Start and end dates are required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json(
      { success: false, message: 'Invalid date format' },
      { status: 400 }
    );
  }

  try {
    // Validate token and get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, preferred_language, building_address, unit_number')
      .eq('tenant_access_token', token)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get available slots (any staff)
    const slots = await getAvailableSlots({
      staffId: null, // Any available staff
      startDate,
      endDate,
      minLeadTimeHours: 24,
      maxHorizonDays: 28,
    });

    // Get unique staff info for context
    const staffIds = [...new Set(slots.map(s => s.staffId))];
    const { data: staffInfo } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name')
      .in('id', staffIds);

    const staffMap = new Map(staffInfo?.map(s => [s.id, s.display_name]) || []);

    // Format slots for response
    const formattedSlots = slots.map(slot => ({
      staffId: slot.staffId,
      staffName: staffMap.get(slot.staffId) || slot.staffDisplayName,
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
      durationMinutes: slot.durationMinutes,
      dateKey: slot.startTime.toISOString().split('T')[0],
      timeDisplay: slot.startTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    }));

    // Group by date for easier UI consumption
    const groupedSlots = formattedSlots.reduce((acc, slot) => {
      if (!acc[slot.dateKey]) {
        acc[slot.dateKey] = [];
      }
      acc[slot.dateKey].push(slot);
      return acc;
    }, {} as Record<string, typeof formattedSlots>);

    return NextResponse.json({
      success: true,
      data: {
        application: {
          id: application.id,
          tenantName: application.head_of_household_name,
          preferredLanguage: application.preferred_language,
          buildingAddress: application.building_address,
          unitNumber: application.unit_number,
        },
        slots: groupedSlots,
        totalSlots: formattedSlots.length,
      },
    });
  } catch (error: any) {
    console.error('[scheduling/slots] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
