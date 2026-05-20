# Appointment Scheduling — Detailed Build Plan

**Scope:** In-person appointment scheduling for PBV applications (document signing + maintenance inspections required before completion).

**Phases:** 1, 2, 4 (Phase 3 SMS deferred, Phase 5 reporting deferred)

---

## Part 1: Database Migration

**File:** `supabase/migrations/20260514180000_appointment_scheduling.sql`

### Tables to Create

```sql
-- 1. staff_availability_templates (weekly recurring availability)
CREATE TABLE staff_availability_templates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references admin_users(id) on delete cascade,
  weekday int not null CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_minutes int default 30,
  buffer_minutes int default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX sat_staff_idx ON staff_availability_templates(staff_id, weekday);

-- RLS: staff can only see/edit their own; admins can see/edit all

-- 2. staff_availability_overrides (specific date exceptions)
CREATE TABLE staff_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references admin_users(id) on delete cascade,
  date date not null,
  start_time time,                      -- null = closed all day
  end_time time,
  slot_minutes int,
  buffer_minutes int,
  reason text,
  UNIQUE(staff_id, date)
);

-- 3. appointments (the actual scheduled appointments)
CREATE TABLE appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  staff_id uuid references admin_users(id) not null,
  starts_at timestamptz not null,
  duration_minutes int not null,
  purpose text not null CHECK (status IN (
    'sign_documents',      -- tenant needs to sign docs in person
    'inspection_required', -- unit inspection needed before approval
    'intake_help',         -- help with application intake
    'document_drop',       -- drop off physical documents
    'other'
  )),
  status text not null default 'scheduled' CHECK (status IN (
    'scheduled',
    'completed',
    'no_show',
    'cancelled',
    'rescheduled'
  )),
  rescheduled_from_id uuid references appointments(id) null,
  tenant_confirmed_at timestamptz,
  created_by uuid references admin_users(id),  -- null if tenant self-scheduled
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  notes text
);

CREATE INDEX appt_staff_date_idx ON appointments(staff_id, starts_at);
CREATE INDEX appt_app_idx ON appointments(application_id, starts_at desc);
CREATE INDEX appt_rescheduled_from_idx ON appointments(rescheduled_from_id) WHERE rescheduled_from_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_appointments
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_templates
  BEFORE UPDATE ON staff_availability_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RLS Policies
ALTER TABLE staff_availability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Templates: staff see own, admins see all
CREATE POLICY staff_templates_own ON staff_availability_templates
  FOR ALL TO service_role USING (staff_id = auth.uid());

CREATE POLICY admin_templates_all ON staff_availability_templates
  FOR ALL TO service_role USING (
    EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid() AND user_type = 'stanton_staff')
  );

-- Same pattern for overrides and appointments
-- (Full RLS to be written in migration)
```

---

## Part 2: Slot Generation Engine

**File:** `lib/scheduling/slots.ts`

```typescript
export interface Slot {
  staffId: string;
  staffName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}

export interface GetAvailableSlotsOptions {
  staffId?: string | null;  // null = any staff (aggregated across all)
  startDate: Date;
  endDate: Date;
  minLeadTimeHours?: number;  // default 24
  maxHorizonDays?: number;    // default 28 (4 weeks)
  purpose?: string;           // for validation/context
}

export async function getAvailableSlots(
  options: GetAvailableSlotsOptions
): Promise<Slot[]>

export async function getStaffAvailabilityForDate(
  staffId: string,
  date: Date
): Promise<{ slots: Slot[]; isOverride: boolean; overrideReason?: string }>
```

**Logic:**
1. Fetch all active templates for specified staff (or all staff)
2. Fetch all overrides for date range
3. For each date in range:
   - Check if override exists → use override (if start_time null, day is closed)
   - Otherwise use template for that weekday
4. Generate slots at slot_minutes intervals within open hours
5. Subtract existing appointments (status != 'cancelled', status != 'rescheduled')
6. Filter out slots < minLeadTimeHours from now
7. Return sorted chronologically

---

## Part 3: Staff Availability Configuration UI

**Page:** `/admin/scheduling/availability`

**Layout:**
- Header: "Scheduling Availability" + staff selector (admin sees all, staff sees only self)
- Weekly Grid: 7 rows (Sun-Sat), each with:
  - Day name
  - Active toggle (checkbox)
  - Start time input (time picker)
  - End time input (time picker)
  - Slot duration select (15, 30, 60 min)
  - Buffer minutes input
  - Save button per row
- Date Overrides Section (below):
  - Table: Date | Hours | Reason | Actions
  - "Add Override" button → modal with date picker, hours toggle, inputs, reason
  - Ability to mark day as "Closed"

**API Routes:**
- `GET /api/admin/scheduling/availability/templates` – get current staff templates
- `POST /api/admin/scheduling/availability/templates` – save/update single day template
- `GET /api/admin/scheduling/availability/overrides` – get overrides for date range
- `POST /api/admin/scheduling/availability/overrides` – create override
- `DELETE /api/admin/scheduling/availability/overrides/[id]` – delete override

**Navigation:** Add to `adminNav.ts` under "Program Compliance" section

---

## Part 4: Tenant-Facing Scheduler

**Page:** `/schedule/[token]`

**Token validation:** Reuse existing magic link pattern (same as `/t/[token]`)

**Flow:**
1. Validate token → get `pbv_full_applications` record
2. Auto-detect language from `preferred_language` (en/es/pt)
3. Check query param `?purpose=` (optional context)
4. Show LanguageLanding if language not detected, otherwise skip

**Weekly Grid View:**
- Header: "Schedule your visit" (translated) + tenant name
- Purpose context: "You're coming in to sign {N} documents" or "Unit inspection required"
- Week navigation: ← Previous | Current Week | Next →
- Days displayed: Mon-Fri (or all 7 depending on availability)
- Per day: Show available slot count or "No slots"
- Clickable slots → confirmation screen

**Confirmation Screen:**
- Date & time (formatted in tenant's language)
- Stanton office address: 421 Park Street, Hartford CT 06106
- Assigned staff name
- What to bring (contextual based on purpose):
  - `sign_documents`: list of unsigned docs
  - `inspection_required`: "Unit will be inspected"
  - `document_drop`: "All documents you need to submit"
- "Confirm" button → creates appointment

**Success Page:** `/schedule/[token]/success`
- Booking details summary
- .ics download button
- "Add to Calendar" buttons (Google, Outlook via .ics)

**API Routes:**
- `GET /api/scheduling/slots?token=xxx&start=YYYY-MM-DD&end=YYYY-MM-DD`
- `POST /api/scheduling/appointments` – create appointment
- `GET /api/scheduling/appointments/[id]` – get appointment details

**Components to create:**
- `components/scheduling/TenantScheduler.tsx` – main weekly grid
- `components/scheduling/SlotConfirmation.tsx` – confirmation screen
- `components/scheduling/AppointmentSuccess.tsx` – success page
- `lib/scheduling/translations.ts` – EN/ES/PT strings

---

## Part 5: ICS Calendar Generation

**Route:** `/api/scheduling/appointments/[id]/ics`

**Implementation:**
- Generate vCalendar format (.ics) server-side
- Summary: "Stanton Management — PBV {purpose}"
- Location: 421 Park Street, Hartford CT 06106
- Attendee: tenant (from application)
- Organizer: assigned staff
- UID: appointment ID
- DTSTART/DTEND: from appointment

**File:** `lib/scheduling/ics.ts` – pure function to generate ICS string

---

## Part 6: Staff Day View

**Page:** `/admin/scheduling/today` (and `/admin/scheduling?date=YYYY-MM-DD`)

**Layout (desktop-first):**
- Header: "Appointments" + date picker + prev/next day navigation
- Filter toggle: "Show all staff" / "My appointments only"
- Chronological list of appointments for selected date

**Per Appointment Card:**
- Time + duration
- Status badge (scheduled/completed/no-show)
- Tenant name + unit number + phone
- Purpose badge (sign_documents/inspection_required/etc.)
- **Context section:**
  - For `sign_documents`: list unsigned docs from `application_documents`
    - Query: `WHERE anchor_type = 'pbv_full_application' AND requires_signature = true AND status NOT IN ('approved','waived')`
  - For `inspection_required`: show "Unit inspection pending"
- Actions row:
  - "Mark complete" → status = 'completed', prompt for notes
  - "Mark no-show" → status = 'no_show', log application_event
  - "Reschedule" → open slot picker modal, creates new appointment
  - "Print prep packet" → generates PDF with unsigned docs, opens new tab

**Reschedule Flow:**
- Opens slot picker (same component as tenant-facing)
- Staff can select new slot OR send link to tenant
- On selection: mark old as `rescheduled`, create new with `rescheduled_from_id`

**API Routes:**
- `GET /api/admin/scheduling/appointments?date=YYYY-MM-DD&staffId=xxx`
- `PATCH /api/admin/scheduling/appointments/[id]` – update status, notes
- `POST /api/admin/scheduling/appointments/[id]/reschedule` – reschedule action
- `GET /api/admin/scheduling/appointments/[id]/prep-packet` – generate PDF

**Components:**
- `components/scheduling/StaffDayView.tsx`
- `components/scheduling/AppointmentCard.tsx`
- `components/scheduling/RescheduleModal.tsx`

---

## Part 7: Application Events Integration

**File:** `lib/events/application-events.ts` – add new event types

```typescript
// Add to ApplicationEventType
APPOINTMENT_SCHEDULED:     'appointment.scheduled',
APPOINTMENT_COMPLETED:     'appointment.completed',
APPOINTMENT_NO_SHOW:       'appointment.no_show',
APPOINTMENT_RESCHEDULED:   'appointment.rescheduled',
APPOINTMENT_CANCELLED:     'appointment.cancelled',

// Add to EventPayloadMap
'appointment.scheduled': {
  appointment_id: string;
  staff_id: string;
  staff_name: string;
  starts_at: string;
  purpose: string;
  self_scheduled: boolean;
};
'appointment.no_show': {
  appointment_id: string;
  staff_id: string;
  scheduled_time: string;
  purpose: string;
};
// etc.
```

**Usage:**
- On appointment creation → `writePbvApplicationEvent({ eventType: 'appointment.scheduled', ... })`
- On no-show → `writePbvApplicationEvent({ eventType: 'appointment.no_show', ... })`
- These events appear in application timeline for context

---

## Part 8: Navigation & Permissions

**adminNav.ts:** Add under "Program Compliance":
```typescript
{
  label: 'Scheduling',
  href: '/admin/scheduling/today',
  keywords: ['appointment', 'schedule', 'calendar', 'booking', 'availability'],
}
```

**Permissions:**
- New permission: `scheduling:read`, `scheduling:write`
- Staff can manage own availability
- Admins can manage all staff availability
- HACH users blocked by existing middleware (already in place)

**Middleware:** Already handles HACH user isolation via `middleware.ts`

---

## Part 9: File Structure

```
lib/scheduling/
  slots.ts           # Slot generation engine
  ics.ts             # ICS file generation
  translations.ts    # EN/ES/PT strings
  queries.ts         # DB queries for scheduling

components/scheduling/
  TenantScheduler.tsx      # Weekly grid for tenants
  SlotConfirmation.tsx     # Confirmation screen
  AppointmentSuccess.tsx   # Success page
  StaffDayView.tsx         # Day view for staff
  AppointmentCard.tsx      # Single appointment card
  AvailabilityEditor.tsx   # Staff availability config
  RescheduleModal.tsx      # Reschedule flow

app/
  schedule/
    [token]/
      page.tsx           # Tenant scheduler entry
      success/page.tsx   # Success page
  api/
    scheduling/
      slots/route.ts              # Get available slots
      appointments/route.ts       # Create appointment
      appointments/[id]/route.ts   # Get/update appointment
      appointments/[id]/ics/route.ts  # Download ICS
    admin/scheduling/
      availability/templates/route.ts   # CRUD templates
      availability/overrides/route.ts    # CRUD overrides
      appointments/route.ts              # List appointments
      appointments/[id]/route.ts         # Update appointment
      appointments/[id]/reschedule/route.ts  # Reschedule
      appointments/[id]/prep-packet/route.ts # Generate PDF
```

---

## Implementation Order

1. **Migration** – Create tables, RLS, indexes
2. **Core library** – `lib/scheduling/slots.ts`, `lib/scheduling/ics.ts`
3. **Staff availability UI** – Backend API + frontend config page
4. **Tenant scheduler** – Token validation, slot display, booking
5. **ICS generation** – Calendar invite endpoint
6. **Staff day view** – List view with context (unsigned docs)
7. **Actions** – Complete, no-show, reschedule with event logging
8. **Navigation** – Add to sidebar, verify HACH blocking

---

## Acceptance Criteria Mapping

| Criteria | Implementation |
|----------|---------------|
| Migration runs cleanly | Part 1 |
| Staff configures weekly availability | Part 3 |
| Override excludes date from slots | Part 2 + Part 3 |
| Tenant sees weekly grid at `/schedule/[token]` | Part 4 |
| Booking creates `appointments` row | Part 4 |
| Success page with .ics | Part 4 + Part 5 |
| .ics opens in Apple/Outlook | Part 5 |
| Staff day view at `/admin/scheduling/today` | Part 6 |
| Shows unsigned docs context | Part 6 (application_documents query) |
| Mark complete/no-show persists | Part 6 + Part 7 (events) |
| Reschedule flow works end-to-end | Part 6 |
| Booked slots unavailable to others | Part 2 (slot generation excludes) |
| <24h slots hidden | Part 2 (minLeadTimeHours) |
| HACH blocked from `/admin/scheduling/*` | Part 8 (existing middleware) |

---

## Deferred to Next Pass (Phase 3 & 5)

- SMS confirmations on booking
- T-24h and T-2h reminders
- Reschedule/cancel links via SMS
- No-show threshold tracking
- Repeat no-show flag on application detail
- Reporting dashboard

---

## Open Questions for User

1. **Inspection integration** – Is there a specific table/column tracking required inspections per unit/application? Should the "inspection_required" purpose auto-populate from unit status?

2. **Staff assignment** – Should tenants pick their preferred staff, or should the system auto-assign based on availability? (Prompt says "tenant picks any available staff")

3. **Multiple appointments** – Can a tenant book multiple appointments (e.g., one for inspection, one for signing)? Current schema supports it.

4. **Prep packet PDF** – Should this reuse existing document generation logic from HHA/export? What format (single PDF vs zip)?

5. **Office hours** – What are Stanton's standard office hours? (Need for template defaults)
