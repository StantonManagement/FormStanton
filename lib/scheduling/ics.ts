/**
 * ICS Calendar Invite Generation
 * Standard vCalendar format for appointment calendar invites
 */

export interface IcsEventData {
  id: string;
  summary: string;
  description?: string;
  location: string;
  startTime: Date;
  endTime: Date;
  organizerEmail?: string;
  organizerName?: string;
  attendeeEmail?: string;
  attendeeName?: string;
}

/**
 * Generate a vCalendar (.ics) string for an appointment
 */
export function generateICS(data: IcsEventData): string {
  const formatDate = (date: Date): string => {
    // Format: 20240115T143000Z (UTC)
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };

  const formatDateLocal = (date: Date): string => {
    // Format for local time: 20240115T143000
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const sec = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}T${hour}${min}${sec}`;
  };

  const escapeText = (text: string): string => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stanton Management//Appointment Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:stanton-appointment-${data.id}@stantonmanagement.com`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART;TZID=America/New_York:${formatDateLocal(data.startTime)}`,
    `DTEND;TZID=America/New_York:${formatDateLocal(data.endTime)}`,
    `SUMMARY:${escapeText(data.summary)}`,
  ];

  if (data.description) {
    lines.push(`DESCRIPTION:${escapeText(data.description)}`);
  }

  if (data.location) {
    lines.push(`LOCATION:${escapeText(data.location)}`);
  }

  // Organizer (staff member)
  if (data.organizerEmail || data.organizerName) {
    const organizerEmail = data.organizerEmail || 'noreply@stantonmanagement.com';
    const organizerName = data.organizerName || 'Stanton Management';
    lines.push(`ORGANIZER;CN="${escapeText(organizerName)}":mailto:${organizerEmail}`);
  }

  // Attendee (tenant)
  if (data.attendeeEmail || data.attendeeName) {
    const attendeeEmail = data.attendeeEmail || '';
    const attendeeName = data.attendeeName || 'Tenant';
    if (attendeeEmail) {
      lines.push(`ATTENDEE;CN="${escapeText(attendeeName)}";RSVP=TRUE:mailto:${attendeeEmail}`);
    }
  }

  // Reminder notifications
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT24H',  // 24 hours before
    'END:VALARM',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT2H',   // 2 hours before
    'END:VALARM'
  );

  lines.push(
    'END:VEVENT',
    'END:VCALENDAR'
  );

  return lines.join('\r\n') + '\r\n';
}

/**
 * Generate ICS file content with standard Stanton appointment details
 */
export function generateAppointmentICS(
  appointmentId: string,
  purpose: string,
  startTime: Date,
  endTime: Date,
  staffName: string,
  tenantName: string,
  tenantEmail?: string
): { filename: string; content: string; contentType: string } {
  const purposeLabel = getPurposeLabel(purpose);
  
  const icsData: IcsEventData = {
    id: appointmentId,
    summary: `Stanton Management — PBV ${purposeLabel}`,
    description: `Appointment with ${staffName} at Stanton Management office.\n\nPurpose: ${purposeLabel}\nTenant: ${tenantName}`,
    location: '421 Park Street, Hartford CT 06106',
    startTime,
    endTime,
    organizerName: staffName,
    organizerEmail: 'appointments@stantonmanagement.com',
    attendeeName: tenantName,
    attendeeEmail: tenantEmail,
  };

  const content = generateICS(icsData);
  const dateStr = startTime.toISOString().split('T')[0];
  const filename = `stanton-appointment-${dateStr}-${appointmentId.slice(0, 8)}.ics`;

  return {
    filename,
    content,
    contentType: 'text/calendar; charset=utf-8',
  };
}

function getPurposeLabel(purpose: string): string {
  const labels: Record<string, string> = {
    'sign_documents': 'Document Signing',
    'inspection_required': 'Unit Inspection',
    'intake_help': 'Application Assistance',
    'document_drop': 'Document Drop-off',
    'other': 'Office Visit',
  };
  return labels[purpose] || 'Office Visit';
}
