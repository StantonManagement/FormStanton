# Multi-Project Compliance — Phase 2: Staff UI
# Windsurf Implementation Prompt

---

## Before you write a single line of code

1. Read `multi-project-compliance-prp.md` in full.
2. Audit the existing admin UI — specifically the compliance page, forms library page, and any other admin list/detail pages. Match their layout patterns, component conventions, and styling exactly. This should look like it was always part of the app.
3. Audit `types/compliance.ts` — all Phase 1 types are there. Use them. Do not redefine anything.
4. Audit the Phase 1 API routes under `app/api/admin/projects/`, `app/api/admin/task-types/`, and `app/api/admin/tenant-profiles/` to understand what each endpoint accepts and returns before building UI that calls them.
5. Audit the existing admin nav to understand where to add the new entry.
6. Do not guess at anything. Read first.

---

## Objective

Build the staff-facing project management UI. This is the set of screens where staff create projects, define tasks, scope units, activate, and send links.

No tenant portal. No matrix changes. No Twilio. Those are later phases.

---

## New Route

All new pages live under `/admin/projects/`.

---

## Page 1 — Projects List `/admin/projects`

A list of all projects. Entry point for everything in this phase.

**Layout:**
- Page header: "Projects" + "New Project" button (primary)
- Table or card list of projects, sorted by `created_at` desc
- Each row shows: project name, status badge (draft/active/closed), deadline, unit count, % complete
- % complete = task_completions where status = 'complete' / total task_completions for that project
- Clicking a row navigates to `/admin/projects/[id]`
- Empty state: "No projects yet. Create your first project."

**Status badge colors:**
- draft → gray
- active → blue
- closed → green

---

## Page 2 — Project Detail `/admin/projects/[id]`

This is the main workspace for a project. Tabbed layout.

**Header:**
- Project name (editable inline or via edit button)
- Status badge
- Deadline (editable)
- Back link to `/admin/projects`

**Tabs: Setup / Units / Send Links**

---

### Tab 1 — Setup

Two sections: Project Settings and Task List.

**Project Settings:**
- Name (text input)
- Description (textarea, optional)
- Deadline (date picker)
- Sequential toggle (yes/no — if yes, tenants must complete tasks in order)
- Save button — PATCH `/api/admin/projects/[id]`
- Project can only be edited when status is `draft`. Show read-only view if `active` or `closed`.

**Task List:**
- Ordered list of tasks assigned to this project
- Each task shows: order index, task name, evidence type badge, assignee badge (tenant/staff), required toggle
- Drag to reorder (update `order_index` on drop) — or up/down arrow buttons if drag-to-reorder is complex
- Remove button per task (DELETE `/api/admin/projects/[id]/tasks/[taskId]`)
- "Add Task" button opens a panel or modal:
  - Search/select from existing task types (GET `/api/admin/task-types`)
  - OR "Create new task type" inline form (POST `/api/admin/task-types` then POST `/api/admin/projects/[id]/tasks`)
  - New task type fields: name, description, assignee (tenant/staff), evidence_type (dropdown), instructions, form_id (only shown if evidence_type = 'form' — render a searchable dropdown of forms from the forms library)
- Task list is read-only if project is `active` or `closed`

**Activate button:**
- Shown when status is `draft` and at least one task and one unit are configured
- On click: confirmation modal — "Activate this project? This will generate tenant links for [N] units. Tasks cannot be edited after activation."
- On confirm: POST `/api/admin/projects/[id]/activate` with the scoped unit list
- On success: project status becomes `active`, navigate to Units tab

---

### Tab 2 — Units

Scope which units are included in this project and see their status.

**Unit scoping (only editable in draft status):**
- Three modes: All Portfolio / By Building / Handpick
- All Portfolio: pulls full building+unit list from existing data (use same source as compliance page)
- By Building: multi-select building dropdown
- Handpick: searchable unit list with checkboxes
- Selected unit count shown: "47 units selected"

**Unit table (shown after activation):**
- Columns: building, unit, language, overall status, tasks complete (e.g. 2/4), token expires, delivery status
- Filter by overall_status
- Per-row action: "Regenerate link" (PATCH `/api/admin/projects/[id]/units/[unitId]/token`) — shown when token is expired
- Overall status badge colors match task_completion cell states: green/red/yellow/gray

---

### Tab 3 — Send Links

Bulk and individual link delivery. Twilio is not built yet — this tab sets up the UI shell that Phase 5 will wire up.

**For now (Phase 2):**
- Table of units with their unique tenant link
- "Copy link" button per row
- Bulk "Copy all links" (copies a formatted list)
- Language shown per unit
- Delivery status column (will show Twilio status in Phase 5 — for now show "—")
- Placeholder notice: "SMS delivery via Twilio coming soon. For now, copy and send links manually."

---

## Navigation

Add "Projects" to the admin nav. Audit where other nav items are defined and add it there — do not hardcode it in just the layout file if there's a nav config.

---

## Component Location

New components for this feature go in `components/projects/`. Follow the same pattern as `components/compliance/`.

---

## State & Data Fetching

Follow the same patterns as the compliance page:
- Custom hooks in `lib/` for data fetching (e.g. `useProjects`, `useProjectDetail`)
- No inline fetch logic in page components
- Loading states and error states required on every data fetch
- Optimistic updates where appropriate (e.g. toggling required on a task)

---

## Verify

- `tsc --noEmit` must pass with zero errors
- All new pages are reachable from the admin nav
- Projects list, detail, and all three tabs render without errors
- Activate flow works end to end: draft project with tasks + units → activate → status changes → units tab shows generated rows
- No existing pages, components, hooks, or API routes modified
- `next build` passes clean
