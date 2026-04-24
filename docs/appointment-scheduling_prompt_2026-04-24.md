# Windsurf Prompt — In-Person Appointment Scheduling

**PRD:** `appointment-scheduling_prd_2026-04-24.md` (read it first)

**Required dependencies already built:** `hach-auth` (Stanton staff auth), Twilio client configured

---

## Context

Some tenants can't sign documents digitally — elderly, limited tech access, language barriers beyond what a phone can handle. They need to come to the Stanton office in person. Today this is scheduled over the phone with lots of missed appointments and staff showing up without knowing what the tenant needs to sign.

We're building a Calendly-style scheduling tool, scoped to PBV operational needs:
- Staff configures availability
- Tenant picks a slot via a link
- Reminders go out automatically
- Staff sees the day's appointments with full context on what each tenant needs to accomplish

---

## Build this pass

Phases 1, 2, and 4 from the PRD. Phases 3 (SMS confirmations + reminders) and 5 (reporting) are the next pass — Phase 3 is deferred until Twilio bulk-send is fully production-ready.

### Specific scope

1. **Migration** per PRD schema:
   - `staff_availability_templates`
   - `staff_availability_overrides`
   - `appointments`

2. **Availability configuration UI** at `/admin/scheduling/availability`:
   - Per-staff view (staff can only edit their own; admins can edit anyone's)
   - Weekly grid: 7 rows (days), each row configurable (start time, end time, slot minutes, buffer minutes, active/inactive)
   - Date overrides table below: "On Dec 25, closed" or "On Jun 1, 12pm–3pm only"
   - Save per template row, save per override row
   - Match existing admin UI aesthetic

3. **Slot generation function** at `lib/scheduling/slots.ts`:
   ```ts
   export async function getAvailableSlots(
     staffId: string | null,   // null = any staff
     startDate: Date,
     endDate: Date
   ): Promise<Slot[]>
   ```
   - Reads template for staff (or all staff if null)
   - Applies overrides
   - Excludes dates with override where start_time is null (closed day)
   - Generates slots at slot_minutes intervals within open hours
   - Subtracts existing appointments (status != cancelled)
   - Filters out slots < 24h from now (configurable)
   - Filters out slots beyond 4 weeks (configurable)

4. **Tenant-facing scheduler** at `/schedule/[token]`:
   - Token is an application magic link token (reuse existing `tokens` or `project_units.tenant_link_token`)
   - Page language = tenant's preferred_language
   - Header: "Schedule your visit" (translated) + purpose context if provided via query param
   - Weekly grid view of available slots (grouped by day, chronological within each day)
   - Navigation: ← previous week / next week →
   - Click slot → confirmation screen: date/time/address/staff/what to bring
   - Confirm → create `appointments` row, redirect to success page
   - Success page shows booking details + .ics download link

5. **Calendar invite (.ics)**:
   - Generate `.ics` file server-side at `/api/scheduling/appointments/[id]/ics`
   - Standard vCalendar format
   - Summary: "Stanton Management — PBV {purpose}"
   - Location: 421 Park Street, Hartford CT 06106
   - Attendee: tenant
   - Organizer: assigned staff

6. **Staff day view** at `/admin/scheduling/today` (and `/admin/scheduling?date=YYYY-MM-DD` for other days):
   - Chronological list of today's appointments (all staff by default, filter to own)
   - Per appointment card:
     - Time + duration
     - Tenant name + unit + phone
     - Purpose
     - Context: list of unsigned documents for this application (from `form_submission_documents` where signer-required and not yet signed)
     - Actions: "Mark complete" / "Mark no-show" / "Reschedule" / "Print prep packet"
   - Print prep packet action: generates a PDF with all documents needing signature, opens in new tab
   - Navigation: previous day / next day / date picker

7. **Mark complete / no-show** actions:
   - Update `appointments.status`
   - If no-show, log `application_events` row (for pipeline dashboard surface)
   - If completed, prompt for notes

8. **Reschedule action**:
   - Opens same slot picker (reuses tenant-facing component)
   - On selection, marks existing as `rescheduled` and creates a new appointment with reference back

---

## Tech constraints

- Next.js App Router
- Reuse tenant magic link auth pattern — don't build a separate auth for scheduling links
- TypeScript
- Inline styles matching existing aesthetic
- Tenant-facing page must be mobile-first (phones are the primary device)
- Staff day view is desktop-first

---

## Acceptance criteria

- [ ] Migration runs cleanly
- [ ] Staff can configure weekly availability and save — reloading the page shows the saved template
- [ ] Staff can add an override for a specific date (e.g., closed Dec 25) — slot generation excludes that date
- [ ] Tenant opening `/schedule/[valid-token]` sees a weekly grid of available slots in their language
- [ ] Clicking an available slot opens confirmation; clicking confirm creates an `appointments` row
- [ ] After booking, tenant sees success page with booking details
- [ ] `.ics` download produces a valid calendar file that opens in Apple Calendar and Outlook
- [ ] Staff day view at `/admin/scheduling/today` shows today's appointments with correct context (unsigned docs)
- [ ] "Mark complete" and "Mark no-show" actions persist and log events
- [ ] Reschedule flow works end-to-end (old appointment marked rescheduled, new one created, linked)
- [ ] Existing appointments make that slot unavailable to other tenants
- [ ] A tenant attempting to book a slot <24h from now doesn't see it in the grid
- [ ] HACH users cannot access `/admin/scheduling/*` (blocked by `hach-auth` middleware)

---

## Do NOT in this pass

- Build SMS confirmations or reminders (Phase 3 — defer)
- Build the repeat-no-show threshold flag (Phase 5 — defer)
- Build external calendar integration (Google/Outlook sync)
- Build waitlist when no slots available
- Build walk-in support
- Build recurring appointments
