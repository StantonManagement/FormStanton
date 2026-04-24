# In-Person Appointment Scheduling — PRD

**Status:** Draft — ready for build
**Depends on:** `hach-auth` (staff auth), Twilio (for SMS confirmations/reminders)
**Independent:** Not on the critical path for the HACH reviewer experience

---

## Problem Statement

Some tenants cannot complete PBV application steps digitally — elderly tenants, tenants without smartphones, tenants with low digital literacy. They need to come to the Stanton office to sign forms in person. Today this is scheduled via phone calls, missed appointments are common, and staff show up to sign sessions without full context on what the tenant needs to sign.

We need a Calendly-style scheduling tool, scoped to PBV operational needs:
- Staff configures their availability
- Tenant gets a link, picks a slot, gets a confirmation and reminder
- Staff sees the day's appointments with full context (what this tenant needs to sign, pulled from their application state)
- No-shows tracked so we can follow up

---

## Users & Roles

| Role | What they do |
|---|---|
| Stanton Staff (Tess, Christine, Will) | Configure weekly availability, see day calendar, mark appointments complete/no-show |
| Tenant | Clicks scheduling link (from SMS or email), picks a slot |
| Tenant's family/helper | Can schedule on tenant's behalf (link doesn't require tenant authentication beyond the existing magic link) |
| Alex | Oversees, sees all appointments across staff |

---

## Core Features

### 1. Staff availability configuration (`/admin/scheduling/availability`)

- Weekly template per staff member: for each day of week, define start/end time + slot duration (default 30 min)
- Date overrides: specific dates with different hours or "closed"
- Blackout dates (holidays, staff PTO)
- Reserve buffer between slots (e.g., 10 min between appointments)
- Multiple staff can overlap (tenant picks any available staff, or is assigned one)

### 2. Slot generation

- Computed on demand from template + overrides + existing bookings
- Slots in the past or < 24h from now are filtered out (configurable lead time)
- Slots beyond 4 weeks out are filtered out (configurable horizon)
- Slots already booked are unavailable
- If slot duration = 30 min, slots at :00 and :30 within staff hours

### 3. Scheduling link generation

- Per-tenant link: `/schedule/[application_token]` — reuses or extends existing magic link
- Purpose passed via link: `?purpose=sign_documents` or `?purpose=intake_help` etc.
- Landing page shows:
  - "Hi {tenant name}, schedule your visit to Stanton Management"
  - Purpose context ("You're coming in to sign {N} documents")
  - Calendar view of available slots (weekly grid)
  - Slot picker — tenant clicks, confirms
  - Name + phone confirmation (pre-filled from application)
- Trilingual (EN/ES/PT) based on tenant preferred language

### 4. Slot picker UX

- Week-at-a-time view
- Navigate forward/back (within horizon)
- Available slots are clickable; unavailable slots visible but grayed
- If no slots available, show "No slots available this week — try next week" with nudge

### 5. Confirmation flow

- On selection, show confirmation screen: date, time, address, staff member, what to bring
- SMS confirmation sent immediately (in tenant's language)
- Calendar invite (.ics file) offered for email users
- Tenant can reschedule or cancel from a follow-up link

### 6. Staff day view (`/admin/scheduling/today`)

- List of today's appointments chronologically
- Per appointment: time, tenant name, unit, purpose, context (e.g., "Needs to sign: HUD-9886-A, Citizenship Declaration, Obligations of Family" — pulled from application's unsigned document state)
- Actions per appointment: "Mark complete" / "Mark no-show" / "Reschedule" / "Print prep packet"
- Print prep packet: generates the unsigned docs on demand so staff has paper ready

### 7. Reminder system

- T-24h: SMS reminder to tenant
- T-2h: SMS reminder to tenant
- If tenant replies STOP, suppress reminders (but don't cancel appointment)

### 8. Reschedule / cancel

- Tenant clicks reschedule link → same slot picker, existing appointment cancelled on new selection
- Staff can reschedule from day view — either offers tenant a new time or picks one and notifies tenant
- Cancellations send notification to both sides

### 9. No-show tracking

- If appointment marked no-show, flag on application detail page
- Threshold (e.g., 2 no-shows) surfaces the tenant for Stanton follow-up
- Does not auto-cancel PBV application — just flags for staff attention

---

## Data Model

```sql
CREATE TABLE staff_availability_templates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references admin_users(id) on delete cascade,
  weekday int not null CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_minutes int default 30,
  buffer_minutes int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

CREATE INDEX sat_staff_idx ON staff_availability_templates(staff_id, weekday);

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

CREATE TABLE appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  staff_id uuid references admin_users(id) not null,
  starts_at timestamptz not null,
  duration_minutes int not null,
  purpose text not null,                -- sign_documents / intake_help / document_drop / other
  status text not null default 'scheduled' CHECK (status IN ('scheduled', 'completed', 'no_show', 'cancelled', 'rescheduled')),
  tenant_confirmed_at timestamptz,
  created_by uuid references admin_users(id),  -- null if tenant self-scheduled
  created_at timestamptz default now(),
  notes text
);

CREATE INDEX appt_staff_date_idx ON appointments(staff_id, starts_at);
CREATE INDEX appt_app_idx ON appointments(application_id, starts_at desc);
```

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `hach-auth` | Depends on | Staff authentication |
| Twilio | Write | SMS confirmations + reminders |
| Resend | Write | Email confirmation with .ics attachment |
| Existing `/t/[token]` magic link | Extends | Scheduling link uses same token pattern |
| `pbv_full_applications` / `form_submission_documents` | Read | Compute "what to sign" context per appointment |

---

## Implementation Phases

### Phase 1 — Availability config
- Schema + CRUD for templates and overrides
- `/admin/scheduling/availability` UI per staff
- Slot generation function: `getAvailableSlots(staffId, dateRange) → Slot[]`

### Phase 2 — Tenant-facing scheduler
- `/schedule/[token]` page with language detection
- Week-view slot picker
- Confirmation screen + .ics generation
- Create appointment record

### Phase 3 — Confirmations + reminders
- SMS send on booking (Twilio, language-aware templates)
- Scheduled job for T-24h and T-2h reminders
- Reschedule / cancel links

### Phase 4 — Staff day view
- `/admin/scheduling/today` page
- Context for each appointment from application state
- Mark complete / no-show / reschedule actions
- Print prep packet

### Phase 5 — Reporting
- No-show tracking on application detail
- Threshold flag for repeat no-shows

---

## Out of Scope

- Multi-staff capacity per slot (for now, one appointment per slot per staff)
- Buffer time between different appointment types
- Recurring appointments (annual recertification etc.) — v2
- Staff-to-staff shared calendars or team rollup views
- Integration with external calendars (Google Calendar, Outlook) — v2
- Video/remote appointment option (this is specifically for in-person)
- Waitlist when no slots available

---

## Open Questions

| Question | Owner |
|---|---|
| How far out should tenants be able to book? (2 weeks, 4 weeks, further) | Alex / Tess |
| Should the same link allow rescheduling, or does rescheduling require a new link? | Alex |
| What hours does Stanton office operate — is this uniform across staff or individual? | Alex |
| Do we need walk-in support (tenant arrives without appointment)? If so, how does that interact with the scheduled slots? | Alex / Tess |
| Can a tenant book multiple appointments (e.g., one for signing, one for document drop)? Or should they be combined? | Alex |
