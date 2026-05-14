/**
 * Slot Generation Engine
 * Computes available appointment slots from staff templates + overrides + existing bookings
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface Slot {
  staffId: string;
  staffName: string;
  staffDisplayName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface GetAvailableSlotsOptions {
  staffId?: string | null;  // null = any staff (aggregated across all available)
  startDate: Date;
  endDate: Date;
  minLeadTimeHours?: number;  // default 24
  maxHorizonDays?: number;    // default 28 (4 weeks)
  purpose?: string;           // for future validation rules
}

interface AvailabilityConfig {
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
  slotMinutes: number;
  bufferMinutes: number;
  isOverride: boolean;
  overrideReason?: string;
}

interface StaffInfo {
  id: string;
  display_name: string;
  username: string;
}

/**
 * Generate available appointment slots for a date range
 */
export async function getAvailableSlots(
  options: GetAvailableSlotsOptions
): Promise<Slot[]> {
  const {
    staffId,
    startDate,
    endDate,
    minLeadTimeHours = 24,
    maxHorizonDays = 28,
  } = options;

  // Validate date range
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxHorizonDays);
  
  if (endDate > maxDate) {
    throw new Error(`Booking horizon limited to ${maxHorizonDays} days`);
  }

  // Get cutoff for minimum lead time
  const now = new Date();
  const leadTimeCutoff = new Date(now.getTime() + minLeadTimeHours * 60 * 60 * 1000);

  // Get all staff to check (either specific staff or all active Stanton staff)
  const staffList = await getStaffList(staffId);
  if (staffList.length === 0) {
    return [];
  }

  // Get existing appointments that block slots
  const blockedRanges = await getBlockedAppointmentRanges(
    staffList.map(s => s.id),
    startDate,
    endDate
  );

  const slots: Slot[] = [];

  // Generate slots for each day in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = formatDateISO(currentDate);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday

    for (const staff of staffList) {
      // Get availability for this staff on this date
      const availability = await getStaffAvailabilityForDate(staff.id, dateStr, dayOfWeek);
      
      if (!availability) {
        continue; // No availability configured
      }

      // Skip if day is fully closed (override with null start_time)
      if (availability.isOverride && !availability.startTime) {
        continue;
      }

      // Generate slots for this day's availability
      const daySlots = generateSlotsForDay(
        staff,
        currentDate,
        availability,
        blockedRanges[staff.id] || [],
        leadTimeCutoff
      );
      
      slots.push(...daySlots);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Sort chronologically
  slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return slots;
}

/**
 * Get availability configuration for a specific staff member on a specific date
 */
export async function getStaffAvailabilityForDate(
  staffId: string,
  dateStr: string,
  dayOfWeek: number
): Promise<AvailabilityConfig | null> {
  // First check for an override
  const { data: override } = await supabaseAdmin
    .from('staff_availability_overrides')
    .select('start_time, end_time, slot_minutes, buffer_minutes, reason')
    .eq('staff_id', staffId)
    .eq('override_date', dateStr)
    .maybeSingle();

  if (override) {
    // Override exists - if start_time is null, day is fully closed
    if (!override.start_time) {
      return {
        startTime: '',
        endTime: '',
        slotMinutes: 0,
        bufferMinutes: 0,
        isOverride: true,
        overrideReason: override.reason || 'Closed',
      };
    }

    return {
      startTime: override.start_time,
      endTime: override.end_time || '',
      slotMinutes: override.slot_minutes || 30,
      bufferMinutes: override.buffer_minutes || 0,
      isOverride: true,
      overrideReason: override.reason,
    };
  }

  // No override - use template
  const { data: template } = await supabaseAdmin
    .from('staff_availability_templates')
    .select('start_time, end_time, slot_minutes, buffer_minutes, is_active')
    .eq('staff_id', staffId)
    .eq('weekday', dayOfWeek)
    .eq('is_active', true)
    .maybeSingle();

  if (!template || !template.is_active) {
    return null;
  }

  return {
    startTime: template.start_time,
    endTime: template.end_time,
    slotMinutes: template.slot_minutes,
    bufferMinutes: template.buffer_minutes,
    isOverride: false,
  };
}

/**
 * Get list of staff to generate slots for
 */
async function getStaffList(specificStaffId?: string | null): Promise<StaffInfo[]> {
  if (specificStaffId) {
    const { data } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name, username')
      .eq('id', specificStaffId)
      .eq('is_active', true)
      .single();
    return data ? [data] : [];
  }

  // Get all active Stanton staff who have availability templates
  // First, get staff IDs that have active templates
  const { data: templateStaffIds } = await supabaseAdmin
    .from('staff_availability_templates')
    .select('staff_id')
    .eq('is_active', true);

  const staffIdsWithTemplates = [...new Set((templateStaffIds || []).map(t => t.staff_id))];

  if (staffIdsWithTemplates.length === 0) {
    return [];
  }

  const { data } = await supabaseAdmin
    .from('admin_users')
    .select('id, display_name, username')
    .eq('user_type', 'stanton_staff')
    .eq('is_active', true)
    .in('id', staffIdsWithTemplates);

  return data || [];
}

/**
 * Get existing appointments that block slots
 */
async function getBlockedAppointmentRanges(
  staffIds: string[],
  startDate: Date,
  endDate: Date
): Promise<Record<string, Array<{ start: Date; end: Date }>>> {
  const startStr = startDate.toISOString();
  const endStr = new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('staff_id, starts_at, duration_minutes')
    .in('staff_id', staffIds)
    .gte('starts_at', startStr)
    .lt('starts_at', endStr)
    .not('status', 'in', '(cancelled,rescheduled)');

  const blocked: Record<string, Array<{ start: Date; end: Date }>> = {};

  for (const appt of appointments || []) {
    if (!blocked[appt.staff_id]) {
      blocked[appt.staff_id] = [];
    }
    
    const start = new Date(appt.starts_at);
    const end = new Date(start.getTime() + appt.duration_minutes * 60 * 1000);
    
    blocked[appt.staff_id].push({ start, end });
  }

  return blocked;
}

/**
 * Generate slots for a single day's availability
 */
function generateSlotsForDay(
  staff: StaffInfo,
  date: Date,
  availability: AvailabilityConfig,
  blockedRanges: Array<{ start: Date; end: Date }>,
  leadTimeCutoff: Date
): Slot[] {
  const slots: Slot[] = [];

  // Parse availability times
  const [startHour, startMin] = availability.startTime.split(':').map(Number);
  const [endHour, endMin] = availability.endTime.split(':').map(Number);

  // Create base date for this day
  const baseDate = new Date(date);
  baseDate.setHours(0, 0, 0, 0);

  // Calculate slot times
  const slotDurationMs = availability.slotMinutes * 60 * 1000;
  const bufferMs = availability.bufferMinutes * 60 * 1000;
  const totalSlotMs = slotDurationMs + bufferMs;

  let currentSlotStart = new Date(baseDate);
  currentSlotStart.setHours(startHour, startMin, 0, 0);

  const dayEnd = new Date(baseDate);
  dayEnd.setHours(endHour, endMin, 0, 0);

  while (currentSlotStart < dayEnd) {
    const slotEnd = new Date(currentSlotStart.getTime() + slotDurationMs);

    // Check if this slot is in the past (< lead time cutoff)
    if (currentSlotStart < leadTimeCutoff) {
      currentSlotStart = new Date(currentSlotStart.getTime() + totalSlotMs);
      continue;
    }

    // Check if this slot overlaps with any blocked range
    const isBlocked = blockedRanges.some(blocked => {
      // Slots overlap if slot start is before blocked end AND slot end is after blocked start
      return currentSlotStart < blocked.end && slotEnd > blocked.start;
    });

    if (!isBlocked) {
      slots.push({
        staffId: staff.id,
        staffName: staff.username,
        staffDisplayName: staff.display_name,
        startTime: new Date(currentSlotStart),
        endTime: slotEnd,
        durationMinutes: availability.slotMinutes,
      });
    }

    currentSlotStart = new Date(currentSlotStart.getTime() + totalSlotMs);
  }

  return slots;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Group slots by day for UI display
 */
export function groupSlotsByDay(slots: Slot[]): Map<string, Slot[]> {
  const grouped = new Map<string, Slot[]>();

  for (const slot of slots) {
    const dateKey = formatDateISO(slot.startTime);
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    
    grouped.get(dateKey)!.push(slot);
  }

  // Sort slots within each day
  for (const [, daySlots] of grouped) {
    daySlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  return grouped;
}

/**
 * Format slot time for display
 */
export function formatSlotTime(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format slot date for display
 */
export function formatSlotDate(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
