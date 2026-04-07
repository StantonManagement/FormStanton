# Multi-Project Compliance — Phase 4: Matrix Integration
# Windsurf Implementation Prompt

---

## Before you write a single line of code

1. Read `multi-project-compliance-prp.md` in full.
2. Audit the entire current compliance page and all its components — `app/admin/compliance/page.tsx`, `lib/useComplianceData.ts`, `components/compliance/`, `types/compliance.ts`. Understand every column, every cell renderer, every filter, every bulk action. This refactor must preserve all existing behavior.
3. Audit the column registry (`COMPLIANCE_COLUMNS`) thoroughly — understand how columns are defined, how cells are rendered, and how filters are driven by that registry.
4. Audit the Phase 1 API routes — specifically `GET /api/admin/projects`, `GET /api/admin/projects/[id]`, and `GET /api/admin/projects/[id]/units` — to understand the shape of project and task data.
5. Audit Phase 3's `task_completions` data to understand what cell states are available: `pending`, `complete`, `waived`, `failed`.
6. Do not guess. Read first.

---

## Objective

Make the compliance matrix project-aware. A project selector in the header switches between projects. Columns are driven by the selected project's `project_tasks`. The existing onboarding campaign becomes Project #1 and its view is preserved exactly.

This is a refactor with zero functional regression. Every existing feature of the compliance page must continue to work after this phase.

---

## Core Constraint

The existing compliance page was built around a hardcoded column registry (`COMPLIANCE_COLUMNS`). That registry defines what columns exist, how cells render, and how filters work. That system stays — it is not removed or replaced.

What changes: the compliance matrix gets a second mode. When a multi-project project is selected, columns are generated dynamically from `project_tasks` instead of from `COMPLIANCE_COLUMNS`. When the legacy onboarding project (Project #1) is selected, the existing hardcoded behavior is unchanged.

Think of it as two rendering paths behind one matrix UI.

---

## Step 1 — Project Selector in Header

Add a project selector to `DashboardHeader.tsx` (or wherever the compliance page header lives — audit first).

- Fetches all active + closed projects from `GET /api/admin/projects`
- Includes a "Legacy: Feb 2025 Onboarding" option at the top that represents the current hardcoded view
- Defaults to "Legacy: Feb 2025 Onboarding" on first load — zero behavior change for existing users
- Switching projects:
  - Reloads the matrix with the selected project's units and tasks
  - Updates the URL: `/admin/compliance?project=[id]` (legacy view = no param or `?project=legacy`)
  - Persists selection across page refreshes via URL param

---

## Step 2 — Two Rendering Paths in `useComplianceData`

`useComplianceData` currently fetches data for the legacy view. Extend it to handle both paths.

When `selectedProject === 'legacy'`:
- Existing fetch logic runs exactly as before — no changes
- `COMPLIANCE_COLUMNS` drives columns as before

When `selectedProject` is a project ID:
- Fetch `GET /api/admin/projects/[id]/units` — returns units with `task_completions` joined
- Columns are derived from the project's `project_tasks` ordered by `order_index`
- Each column maps to a `project_task` — name from `task_type.name`, cell state from `task_completions.status`
- Building grouping still applies — group units by building, same as legacy view

The hook should return a `mode` flag (`'legacy' | 'project'`) so the matrix components know which rendering path to use.

---

## Step 3 — Dynamic Column Generation

When in `'project'` mode, generate column definitions dynamically from `project_tasks`.

Each dynamic column:
- `id`: `project_task.id`
- `label`: `task_type.name`
- `assignee`: `task_type.assignee` — show a small badge (tenant/staff) in the column header
- Cell renderer: maps `task_completions.status` to cell states:
  - `complete` → green
  - `pending` → red
  - `failed` → red with failure indicator
  - `waived` → gray
  - missing row → red (treat as pending)
- Filter: same filter mechanism as existing columns — filter by completion status

Do not rip out `COMPLIANCE_COLUMNS`. It stays and drives the legacy path. Dynamic columns are additive.

---

## Step 4 — Matrix Table in Project Mode

The existing `BuildingMatrixTable` renders columns from the registry. When in `'project'` mode it needs to render dynamic columns instead.

Options (pick whichever requires less change to the existing component):
- A: Pass a `columns` prop to `BuildingMatrixTable` — in legacy mode it uses `COMPLIANCE_COLUMNS`, in project mode it receives the dynamic columns
- B: Create a `ProjectMatrixTable` component alongside the existing one

Option A is preferred if the existing component can accept a `columns` prop without major surgery. Audit it first and decide.

**Cell rendering in project mode:**
- Complete → green checkmark cell (reuse existing green cell style)
- Pending → red empty cell (reuse existing red cell style)  
- Waived → gray cell with "—"
- Staff check tasks that are pending → show differently from tenant tasks — staff needs to know these are theirs to complete, not the tenant's problem

**Task completion from admin (all task types):**
- Staff check tasks are completable directly from the matrix cell — clicking a pending staff check cell marks it complete inline
- Review Mode enables pass/fail on ALL task types (tenant and staff), not just staff_check
- POST to: `POST /api/admin/projects/[id]/units/[unitId]/tasks/[taskId]/complete`
- Body: `{ status?: 'complete'|'failed', failure_reason?: string, reviewer_notes?: string, completed_by?: string }`
- No assignee guard — the endpoint accepts any task type

---

## Step 5 — New Staff Task Completion Endpoint

```
POST /api/admin/projects/[id]/units/[unitId]/tasks/[taskId]/complete
```

Auth required (existing `isAuthenticated()` guard).

Body: `{ status?: 'complete'|'failed', failure_reason?: string, reviewer_notes?: string, completed_by?: string }`

Logic:
1. Verify project exists and unit belongs to project
2. Verify task_completions row exists for this unit+task
3. Update `task_completions`: status = complete/failed, completed_by, completed_at, failure_reason, reviewer_notes
4. Recompute `project_units.overall_status` (includes `has_failure` when any required task is failed)
5. Side-effect: update parent project if parent_task_id is set
6. Return updated task_completions row

No assignee guard — this endpoint accepts all task types. Review Mode uses it for pass/fail on tenant and staff tasks alike.

---

## Step 6 — Filter Bar in Project Mode

The existing `MatrixFilterBar` is driven by `COMPLIANCE_COLUMNS`. In project mode it should show one filter per dynamic column instead.

Filter behavior is the same — "show units where [column] is [status]". Only the source of column definitions changes.

Audit `MatrixFilterBar` and extend it to accept either the registry columns or dynamic columns. Do not duplicate the filter rendering logic.

---

## Step 7 — Portfolio View

The existing portfolio view shows buildings with % complete across the legacy columns. In project mode it should show buildings with % complete for the selected project.

% complete per building in project mode:
- Numerator: `task_completions` where status = 'complete' and required = true, for units in this building in this project
- Denominator: total required `task_completions` for units in this building in this project

The portfolio table component likely needs a `mode` prop similar to the matrix table. Audit it and make the minimum change needed.

---

## Step 8 — Existing Onboarding View: Zero Regression

When `selectedProject === 'legacy'`:
- Every column renders exactly as before
- Every filter works exactly as before
- Every bulk action works exactly as before
- Every cell renderer works exactly as before
- The page looks and behaves identically to before this phase

This is non-negotiable. The legacy view is live and in use.

---

## Verify

- `tsc --noEmit` must pass with zero errors
- `next build` must pass clean
- Legacy view (`?project=legacy` or no param): renders identically to before this phase — every column, filter, bulk action, cell state
- Project mode: selecting an active project loads that project's units and tasks as columns
- Staff check cells in project mode: clicking marks complete, cell turns green, unit overall_status recomputes
- Portfolio view updates correctly when switching projects
- URL param persists project selection across refresh
- No existing API routes, hooks, types, or non-compliance components modified
