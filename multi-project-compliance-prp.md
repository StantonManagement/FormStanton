# Multi-Project Compliance System — PRP v1

**Status:** Design — ready for implementation planning
**Last updated:** March 17, 2026
**Author:** Alex / Stanton Management

---

## Problem Statement

The current compliance page is hardcoded around one campaign (Feb 2025 onboarding). The business runs continuously — inspections, renewals, regulatory deadlines, document collection — and needs a general system where staff can define what needs to happen, assign it to units, and track it to completion without building a new page each time.

Secondary constraint: 20–40% hostile tenancy. Tenants will not comply voluntarily. The system must make compliance the path of least resistance and must enforce at the system level — staff points at the screen, they don't negotiate.

---

## Mental Model

Three layers:

**TaskType** — the atomic unit. Reusable across projects. Defines what needs to happen and who does it.

**Project** — a named campaign. An ordered set of TaskTypes applied to a scoped set of units with a deadline.

**TaskCompletion** — the record that a specific unit completed a specific task in a specific project. This is what the compliance matrix reads.

---

## Users & Roles

| Role | What they do |
|---|---|
| Staff (Alex, Dean, Dan, Tiff) | Create projects, define tasks, scope units, send links, mark staff-side tasks, track completion |
| Tenants | Receive a unique link, complete their assigned tasks, done |

---

## Task Types

| Evidence Type | Who completes | Example |
|---|---|---|
| `form` | Tenant | Submit lease addendum from form library |
| `file_upload` | Tenant | Upload insurance certificate |
| `photo` | Tenant | Photo holding today's newspaper |
| `signature` | Tenant | Sign rent increase acknowledgment |
| `acknowledgment` | Tenant | Checkbox: I received this document |
| `staff_check` | Staff | Physically verified smoke alarm present |

Task order within a project is configurable:
- **Sequential** — tenant must complete task 1 before task 2 unlocks
- **Parallel** — all tasks visible and available at once

Tenants always see their full task list regardless of mode. In sequential mode, incomplete prerequisite tasks are shown but locked.

---

## Data Model

```sql
-- Reusable task type definitions
task_types (
  id uuid primary key,
  name text not null,
  description text,
  assignee text not null, -- 'tenant' | 'staff'
  evidence_type text not null, -- 'form' | 'file_upload' | 'photo' | 'signature' | 'acknowledgment' | 'staff_check'
  form_id uuid references forms(id), -- nullable, only if evidence_type = 'form'
  instructions text, -- shown to tenant or staff
  created_at timestamp default now()
)

-- Named campaigns
projects (
  id uuid primary key,
  name text not null,
  description text,
  deadline date,
  status text default 'draft', -- 'draft' | 'active' | 'closed'
  sequential boolean default false,
  created_by text,
  created_at timestamp default now()
)

-- Ordered task list for a project
project_tasks (
  id uuid primary key,
  project_id uuid references projects(id),
  task_type_id uuid references task_types(id),
  order_index integer not null,
  required boolean default true
)

-- One row per unit per project
project_units (
  id uuid primary key,
  project_id uuid references projects(id),
  building text not null,
  unit_number text not null,
  tenant_link_token text unique not null,
  token_expires_at date, -- project deadline + 30 days
  preferred_language text default 'en', -- 'en' | 'es' | 'pt'
  overall_status text default 'not_started', -- 'not_started' | 'in_progress' | 'complete'
  created_at timestamp default now()
)

-- One row per task per unit per project
task_completions (
  id uuid primary key,
  project_unit_id uuid references project_units(id),
  project_task_id uuid references project_tasks(id),
  status text default 'pending', -- 'pending' | 'complete' | 'waived'
  evidence_url text, -- nullable
  form_submission_id uuid, -- nullable, references existing submissions table
  completed_by text, -- 'tenant' or staff user id
  completed_at timestamp,
  notes text
)
```

---

## Token & Link Design

- Tenant link: `form-stanton.vercel.app/t/[token]`
- Token generated at project activation, unique per unit per project
- Expires at: **project deadline + 30 days**
- After expiry: staff generates a new token manually — no zombie links
- Token carries no PII — it resolves to the `project_units` row server-side
- Short URL via Twilio integration (see Delivery section)

---

## Language Handling

- `preferred_language` stored on `project_units` row
- Source: one-way read-only sync from mono DB (AppFolio-synced) → forms DB
- Sync delivers only: unit identifier, preferred language, tenant name — no financial or lease data
- Tenant portal loads in preferred language automatically — no selector shown if language is known
- Fallback for unknown language: English with language selector visible (same as original form)
- Twilio outbound message sent in tenant's preferred language
- Forms from library are already translated (EN/ES/PT) — portal passes language param to form renderer

**Sync architecture:** mono DB → scheduled or webhook-triggered → lightweight `tenant_profiles` table in forms DB. Forms DB never writes back. One-way only.

---

## Staff Flow

1. **Create project** — name, description, deadline, sequential yes/no
2. **Add tasks** — pick from task type library or create new task type inline
3. **Scope units** — all portfolio, by building, or handpick individual units
4. **Activate** — generates `project_units` rows with tokens + `task_completions` rows
5. **Send links** — bulk via Twilio (SMS primary, email secondary), one unique URL per unit, in tenant's preferred language
6. **Track** — compliance matrix: rows = units, columns = tasks, cells = completion status
7. **Staff tasks** — marked complete directly in the matrix by staff
8. **Manage** — waive tasks, resend links, regenerate expired tokens

---

## Tenant Flow

1. Receive SMS with short link
2. Land on `/t/[token]` — sees project name, deadline, their full task list
3. Complete tasks (all visible; sequential tasks lock until prerequisite done)
4. Each task submission updates `task_completions` in real time
5. When all tasks complete — confirmation screen, staff sees green

Portal is designed for hostile-tenancy UX: minimal friction, no ambiguity, no optional steps that look required. Two taps where possible.

---

## Compliance Matrix Behavior

- Project selector in header — switching projects reloads columns
- Rows = units scoped to selected project
- Columns = tasks defined in `project_tasks` for that project
- Cell states: green (complete), red (pending), yellow (in progress), gray (waived)
- Filter by task: "show me all units where smoke alarm check is incomplete"
- Bulk actions: waive task, send reminder, mark staff check complete
- Portfolio view: building rows with % complete per project
- Existing onboarding campaign becomes Project #1 — matrix behavior unchanged

---

## Delivery Integration (Twilio)

- Primary channel: SMS via Twilio
- Secondary: email via existing Resend integration
- Message content: project name, short link, deadline, in tenant's preferred language
- Short URL: Twilio or a simple redirect route (`/r/[token]` → `/t/[token]`)
- Bulk send triggered from project management UI
- Individual resend available per unit from matrix
- Delivery status tracked (sent, delivered, failed) on `project_units` row

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| Mono DB (AppFolio sync) | Read-only → forms DB | Preferred language, unit/tenant identifiers |
| Form Library | Read | Pull forms into task definitions |
| Supabase Storage | Write | Evidence files from tenant task completions |
| Twilio | Write | SMS delivery of tenant links |
| Resend | Write | Email delivery fallback |
| Existing submissions table | Read | Link `form` task completions to existing submission records |

---

## Implementation Phases

### Phase 1 — Data Layer
- DB schema above
- API routes: CRUD projects, CRUD task types, CRUD project tasks, assign units, generate tokens
- Migrate existing onboarding data as Project #1
- `tenant_profiles` table + one-way sync scaffold (can be manual import initially)

### Phase 2 — Staff UI: Project Management
- Projects list page
- Project creation/editing (name, deadline, sequential toggle)
- Task type library (create, edit, reuse)
- Unit scoping + activation
- Send links UI (bulk Twilio + Resend)
- Token regeneration for expired links

### Phase 3 — Tenant Portal
- `/t/[token]` route
- Task list UI — handles all 6 evidence types
- Sequential lock logic
- Language auto-detection from token
- Pulls form from library when evidence_type = `form`
- Hostile-tenancy UX: dead simple, no exits, no confusion

### Phase 4 — Matrix Integration
- Compliance matrix becomes project-aware
- Project selector in header
- Columns driven by `project_tasks` not hardcoded `COMPLIANCE_COLUMNS`
- Existing onboarding view preserved as Project #1
- Portfolio rollup shows % complete per project per building

### Phase 5 — Twilio Integration
- Outbound SMS with short link
- Delivery status tracking
- Language-aware message templates (EN/ES/PT)
- Bulk send + individual resend from matrix

---

## Deferred / Out of Scope for v1

- Token expiry automation (manual regeneration acceptable at launch)
- Full one-way sync automation (manual language import acceptable at launch)
- Tenant portal push notifications
- Project templates (copy project structure for recurring campaigns)

---

## Open Questions

None blocking implementation. Decisions made:

| Question | Decision |
|---|---|
| Task type library: DB or code? | DB — staff-managed |
| Show tenants all tasks or current only? | All tasks, sequential ones locked |
| Token expiry? | Project deadline + 30 days, manual regeneration after |
| Language source? | One-way sync from mono DB; fallback = English + selector |
| Primary delivery channel? | Twilio SMS primary, Resend email secondary |
