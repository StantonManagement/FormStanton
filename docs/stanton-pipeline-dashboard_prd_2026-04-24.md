# Stanton Pipeline Dashboard — PRD

**Status:** Draft — ready for build
**Depends on:** `hach-auth` (Stanton-side scoping), `income-eligibility-engine` (math display), `hach-reviewer-portal` (document state being tracked)
**Uses:** `rejection-tenant-loop` (chase actions, SLA surfacing) when available

---

## Problem Statement

Stanton staff (Tess, Christine) need a single operational view of every PBV conversion unit across all stages of the pipeline — who's where, who's blocked, what's stale, what the next action is. Today this lives in email threads, memory, Supabase folder inspection, and scattered spreadsheets.

Key workflows this supports:
- Daily triage: "what needs attention right now"
- Tenant chase: "who's missing documents, nudge them"
- HACH back-and-forth: "we haven't heard from HACH on these in a while, poke them"
- Staff coordination: "who owns this application"
- Visibility: "where is this one specific application in the process"

This is the Stanton-side mirror of the HACH reviewer portal — same underlying data, different view optimized for pipeline management rather than packet review.

---

## Users & Roles

| Role | Primary usage |
|---|---|
| Tess, Christine (Stanton office staff) | Daily triage, tenant chase, HACH correspondence logging |
| Dean (field staff) | Read-only visibility into units he may need to visit |
| Alex (supervisor) | Portfolio rollup, assignment management, escalations |

---

## Core Features

### 1. Pipeline table (`/admin/pbv/pipeline`)

Rows = applications. Columns:

| Column | Content |
|---|---|
| Unit | Asset ID + unit number + building (monospace for ID, readable for building) |
| Tenant | Name |
| Stage | Current stage (pre_app / intake / stanton_review / submitted_to_hach / hach_review / approved / denied / withdrawn) |
| Blocked On | tenant / stanton / hach / nobody (computed from current state) |
| Days in Stage | How long in current stage |
| Next Action | Short computed string ("chase tenant for paystubs", "submit to HACH", "awaiting HACH review", etc.) |
| Assigned To | Stanton staff member owning the app |
| Income Status | ✓ qualifies / ⚠ delta / ✗ over limit (from income engine) |

Sort by days in stage (most stale first). Filter by building, stage, blocked-on, assigned-to.

### 2. Blocked-on computation

- `tenant` — at least one doc in `missing` or `pending_tenant_action` state
- `stanton` — submission is ready for review or packaging but hasn't been done yet
- `hach` — submitted to HACH, no review action in last N days (N = SLA, default 10)
- `nobody` — fully approved or denied

Shown as a colored pill: blue for tenant, orange for Stanton, purple for HACH.

### 3. Staleness clock

- Days since last activity on the application (any action: doc upload, review, status change, correspondence)
- Surfaced per row
- Rows >14 days stale with status in-progress get amber highlight
- Rows >30 days stale get red highlight

### 4. Assignment

- Each application has one assigned Stanton staff member
- Assignment dropdown on the row pulls from `admin_users WHERE user_type = 'stanton_staff' AND deactivated_at IS NULL`
- Unassigned applications flagged at top of list
- Bulk reassign: select multiple rows, pick new assignee

### 5. HACH correspondence log

- Per application: threaded view of every HACH communication (inbound and outbound)
- Each entry: direction, channel (email/phone/portal/in-person), date, subject, body, who logged it
- "Log HACH email" button — paste-in form for inbound emails (channel = email, direction = inbound)
- "Log HACH call" button — short form for phone calls (channel = phone, notes field)
- Status per correspondence: `awaiting_their_response` / `awaiting_our_response` / `resolved`
- Summary shown on the pipeline row: "Last heard from HACH: 9 days ago" or "Awaiting our response for 3 days"

Even after HACH reviewers start using the portal, phone calls and out-of-band emails will happen. This is the catch-all log.

### 6. Tenant chase actions

- Per application: "Chase tenant" button
- Opens dialog: "What are they missing?"
  - Checklist of outstanding documents (auto-populated from `form_submission_documents` where status in `missing` or `rejected`)
  - Template message preview in tenant's language
  - Send via SMS (Twilio) with fallback to email
- Logs in `tenant_notifications` (shared with rejection-tenant-loop)
- Bulk chase: select rows, "Chase all selected tenants missing paystubs" — same dialog but scoped to selected doc type

### 7. Detail page per application

- `/admin/pbv/pipeline/[id]`
- Similar to existing detail page (already exists for PBV full applications)
- Enhanced with: correspondence log, activity timeline, quick chase button, HACH review status surface (pulled from `hach-reviewer-portal` data)
- "Jump to HACH view" button — if Stanton user has super admin, they can see the same packet from the HACH reviewer's perspective (read-only)

### 8. Portfolio rollup

- Top-of-page summary cards:
  - Total applications in pipeline
  - Count by stage (bar chart or segmented count)
  - Blocked breakdown (# blocked on tenant / Stanton / HACH)
  - Stale count (>14 days)
- By-building breakdown available as collapsible section

### 9. Activity timeline per application

- Chronological list of every event: doc uploaded, doc reviewed, correspondence logged, status change, chase sent
- Most recent first
- Filterable by event type

---

## Data Model

```sql
-- Stage is a controlled value on applications
ALTER TABLE pbv_full_applications
  ADD COLUMN stage text not null default 'intake',
  ADD CONSTRAINT pbv_stage_check CHECK (stage IN (
    'pre_app', 'intake', 'stanton_review', 'submitted_to_hach',
    'hach_review', 'approved', 'denied', 'withdrawn'
  )),
  ADD COLUMN assigned_to uuid references admin_users(id),
  ADD COLUMN stage_changed_at timestamptz default now(),
  ADD COLUMN last_activity_at timestamptz default now();

CREATE INDEX pbv_stage_idx ON pbv_full_applications(stage, last_activity_at desc);
CREATE INDEX pbv_assigned_idx ON pbv_full_applications(assigned_to, last_activity_at desc);

-- HACH correspondence log (catches everything off-portal)
CREATE TABLE hach_correspondence_log (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  direction text not null CHECK (direction IN ('inbound', 'outbound')),
  channel text not null CHECK (channel IN ('email', 'phone', 'portal', 'in_person', 'other')),
  from_party text,
  to_party text,
  subject text,
  body text,
  occurred_at timestamptz not null,
  status text default 'resolved' CHECK (status IN ('awaiting_their_response', 'awaiting_our_response', 'resolved')),
  logged_by uuid references admin_users(id),
  logged_at timestamptz default now()
);

CREATE INDEX hcl_app_idx ON hach_correspondence_log(application_id, occurred_at desc);
CREATE INDEX hcl_status_idx ON hach_correspondence_log(status, occurred_at desc) WHERE status != 'resolved';

-- Activity event stream (denormalized for fast timeline rendering)
CREATE TABLE application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  event_type text not null,             -- doc_uploaded, doc_approved, doc_rejected, status_change, correspondence, chase_sent, assigned, etc.
  actor_id uuid references admin_users(id),
  actor_type text,                      -- staff / reviewer / tenant / system
  summary text not null,
  metadata jsonb,
  occurred_at timestamptz default now() not null
);

CREATE INDEX ae_app_idx ON application_events(application_id, occurred_at desc);
```

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `hach-auth` | Depends on | `stanton_staff` scope |
| `income-eligibility-engine` | Reads | Income status column |
| `hach-reviewer-portal` | Reads | Document review status, HACH review activity |
| `rejection-tenant-loop` | Uses | Tenant chase notifications, shared `tenant_notifications` table |
| Existing `/admin/pbv/full-applications` | Extends | Transition the existing page into this richer dashboard |

---

## Implementation Phases

### Phase 1 — Stage enum + pipeline table
- Schema migration
- Backfill `stage` for existing applications based on current status
- `/admin/pbv/pipeline` page with core table, sorting, filtering
- Computed columns: days in stage, blocked-on, next action

### Phase 2 — Assignment
- Assignment dropdown on table rows
- Unassigned flag
- Bulk reassign
- Filter by assignee

### Phase 3 — Activity event stream
- `application_events` table
- Write helpers for every event type (called from other code paths)
- Timeline component on detail page

### Phase 4 — HACH correspondence log
- `hach_correspondence_log` table + CRUD
- Log email / log call UIs
- Status tracking
- Summary on pipeline row

### Phase 5 — Tenant chase actions
- Single chase dialog (reuses rejection template system for message generation)
- Bulk chase
- Logs in `tenant_notifications`

### Phase 6 — Portfolio rollup
- Top-of-page summary cards
- By-building breakdown

---

## Out of Scope

- Forward-to-alias for auto-logging HACH emails (v2 — paste-in is fine initially)
- Automated stage transitions based on events (v2 — for now, stage changes are explicit actions)
- Custom views / saved filters per user (v2)
- Export to CSV (v2 unless specifically needed)
- Slack/email digest for pipeline state (v2)

---

## Open Questions

| Question | Owner |
|---|---|
| How do existing `pbv_full_applications` statuses map to the new stage enum? | Alex |
| Is there ever a case where an application has more than one Stanton assignee? (e.g., Tess for docs, Christine for HACH liaison) | Alex |
| Should Dean (field staff) have write access to the correspondence log or read-only? | Alex |
| For the tenant chase, should it only allow re-sending if >24h since last chase, to avoid spamming? | Alex / Dan |
