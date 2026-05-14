# Review Workflow — Assignment, Bulk Operations, Application Lead — PRD

**Status:** Draft — ready for review (revised 2026-05-13 to add bulk assignment, Application Lead, and tier-2 owner confirmation)
**Date:** 2026-05-13
**Depends on:** `stanton-workspace-document-lifecycle` (Phase 1 — events feed must exist)
**Blocks:** `workforce-dashboards`

---

## Problem Statement

PBV applications carry dozens of documents per packet. In a real Stanton workday, multiple reviewers are looking at multiple applications at once, with different levels of experience and accountability. Today three gaps make this expensive:

1. **No per-document assignment.** There's no way to say "Dan is on the income docs, Kristine is on the IDs." The results are double-work, drop-the-ball, and stagnation when the one person who knew about a packet is out.

2. **No bulk operations.** When ten new applications arrive at once and need an initial reviewer pass, the only path today is opening each one and assigning by hand. Same friction in reverse — when reassigning Allan's queue while he's out, there's no way to move it in one action.

3. **No application-level lead or second-pass review.** Stanton's actual workflow has a hierarchy: experienced reviewers (or property-specific leads) are accountable for a packet ship-ready. They want to see — and confirm or override — the tier-1 reviewer's decisions before the packet goes to HACH. Today this happens informally over Slack and email, with no audit trail and no way to surface "what does Tess still need to confirm on the packets she leads?"

This PRD addresses all three. It is the prerequisite for `workforce-dashboards` — those dashboards aggregate over the assignment and ownership state introduced here.

---

## Goals

1. Each document can be assigned to one Stanton user (tier-1 reviewer). Assignment is advisory and overridable.
2. Bulk assignment of selected documents to one user. Bulk assignment of selected applications' Application Lead.
3. Each application can optionally have an **Application Lead** — one Stanton user accountable for the packet.
4. When an application has a Lead, every tier-1-reviewed document must also be confirmed by the Lead (tier-2) before the packet can be Sent to HACH (subject to the soft-override path in PRD I).
5. Leads can **flag** a tier-1 decision back for re-review with a reason; the flag is visible to the tier-1 reviewer and the doc moves to a `flagged_for_rereview` state.
6. Every assignment, lead assignment, confirmation, and flag writes to `application_events`.
7. Reviewers and Leads can quickly see their own queues across all applications.

---

## Users & Roles

| Role | Assign doc | Bulk assign | Assign Lead | Be a Lead | Confirm tier-1 / Flag |
|---|---|---|---|---|---|
| Any Stanton admin user | Yes | Yes | Yes | Yes (when assigned) | Yes (on apps where they are the Lead) |
| HACH | — | — | — | — | — |
| Tenant | — | — | — | — | — |

The Application Lead is **not a new role or permission** — it's a per-application designation on a regular Stanton admin user. Any admin can be assigned as Lead on a specific application by any other admin. There is no separate "is this person allowed to be a Lead" gate in v1.

The Lead is **optional**. Applications without a Lead skip tier-2 entirely; the Send-to-HACH preflight uses the original gate from PRD I.

---

## Core Features

### 1. Per-document assignment

Each document row in `StantonReviewSurface` gains a small assignee affordance to the right of the doc label:

- **Unassigned state:** "Assign" link with a plus icon → opens assign dialog.
- **Assigned state:** assignee's initials in a small circle (e.g., "MK" for Maria K.) with tooltip showing full name and assignment date.
- **Claim shortcut:** keyboard `C` while a doc row is focused — assigns the doc to the current user with no dialog.

The assign dialog:
- User picker (autocomplete over active `admin_users`).
- "Assign to me" quick action at the top.
- "Unassign" button if currently assigned.
- Optional note (stored on the event metadata).

Writes `doc_assigned` event with `from_user_id` (previous, may be null) and `to_user_id` (new, may be null for unassign).

### 2. Bulk document assignment

Document review pane:
- Each document row gains a checkbox on its left edge.
- A header checkbox per category selects all docs in that category.
- When at least one doc is selected, a floating action bar appears at the bottom: **Assign selected to…** + count.
- Action bar opens the same assign dialog with the count visible ("Assigning 14 documents to…").
- Soft confirmation when count ≥ 50: "Confirm assigning 67 docs to Dan?"

Each doc in the selection writes its own `doc_assigned` event so the audit trail remains per-document. A single Stanton-private workspace message summarizes the bulk: "Tess assigned 14 docs to Dan." Per-doc messages are suppressed for bulk operations to keep the channel readable.

### 3. Application Lead

A new "Application Lead" field appears in the application header on `/admin/pbv/full-applications/[id]`. Compact display: avatar + name, with an inline "Change" affordance when present, or "Assign Lead" when empty.

Assigning a Lead:
- Click opens a user picker (same autocomplete as doc assignment).
- "Assign to me" quick action.
- "Remove Lead" option when present.
- Reassigning requires no reason (no friction); the change writes an `app_lead_assigned` event with old/new user IDs.
- A Stanton-private workspace message is posted: "Kristine assigned Tess as Application Lead."

### 4. Bulk Application Lead assignment

On `/admin/pbv/full-applications` list page:
- Each application row gains a checkbox.
- When selections exist, a floating action bar shows: **Assign Lead to selected…** + count.
- Same dialog pattern as doc bulk-assign.
- Each app's lead change writes its own event; bulk summarized to one workspace post per app.

### 5. Tier-2 review — Application Lead confirmation

When a document's tier-1 status flips to `approved`, `rejected`, or `waived`, and the application has a Lead:
- `owner_review_status` is set to `'pending'` on that document.
- The doc appears in the Lead's "Awaiting my confirmation" queue.

The Lead's actions on a pending-confirmation doc:
- **Confirm** — `owner_review_status = 'confirmed'`. Sticky; doc is now tier-2 complete.
- **Flag** — opens a small dialog requiring a reason. On submit:
  - `owner_review_status = 'flagged'`
  - Tier-1 status changes to a new value `flagged_for_rereview` (see Data Model below).
  - The doc reappears in the tier-1 queue with the flag reason visible inline.
  - A Stanton-private workspace message names both parties: "Tess flagged Allan's approval of 'Pay Stub — Sofia Martinez' for re-review. Reason: pay period is wrong."
  - Event `doc_owner_flagged` written.
- **Confirm** writes `doc_owner_confirmed`.

After flag, the original tier-1 reviewer (or any tier-1 reviewer) re-acts on the doc. The new tier-1 action again flips `owner_review_status` to `'pending'`. Cycle continues until confirmed.

If the Lead also acts on a doc as tier-1 (Goal: same person can play both roles per Open Question #2 from the prior pass):
- They click Approve / Reject / Waive normally (tier-1 action).
- `owner_review_status` flips to `'pending'` per the rule above.
- A small inline shortcut "Confirm as Lead" appears immediately on the row after the tier-1 action, allowing one-click tier-2 completion without leaving the doc.

### 6. Lead's queue surfaces

A new sub-page at `/admin/pbv/my-work` shows the current user's queues, with tabs:
- **Assigned docs** — tier-1 docs assigned to me (existing content from prior pass).
- **Awaiting my confirmation** — docs with tier-1 complete on apps I lead, where tier-2 isn't yet done. Sorted by age.
- **Apps I lead** — applications where I'm the Application Lead, with summary state (counts of pending tier-1, pending tier-2, ready-to-send).

This page is the seed of the larger "My Work" dashboard in `workforce-dashboards`. It exists here skeletally so the new surfaces have somewhere to land before that PRD ships.

### 7. List-page surfaces

`/admin/pbv/full-applications`:
- New filter pill: **My docs only** — apps containing ≥1 doc assigned to me.
- New filter pill: **I lead** — apps where I'm the Application Lead.
- Each row shows: assignee chip (existing), Lead chip (new, single avatar with tooltip).
- Bulk-assign Lead via row checkboxes (§4).

### 8. Send-to-HACH preflight integration

PRD I's preflight already runs these checks: all required docs approved/waived; `stanton_review_status='approved'`; HHA generated. This PRD adds one conditional check:

> If the application has an Application Lead, every tier-1-reviewed document (`status IN approved/rejected/waived`) must have `owner_review_status = 'confirmed'`.

This is a soft gate — the existing PRD I override path (require a reason) still applies. Apps with no Lead skip the check entirely.

---

## Data Model

### Migration: `20260513XXXXXX_review_workflow.sql`

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. form_submission_documents — assignment + tier-2 fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.form_submission_documents
  -- Assignment (tier-1 reviewer)
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  -- Application Lead's tier-2 confirmation
  ADD COLUMN IF NOT EXISTS owner_review_status TEXT
    CHECK (owner_review_status IS NULL
      OR owner_review_status IN ('pending', 'confirmed', 'flagged')),
  ADD COLUMN IF NOT EXISTS owner_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_reviewed_by UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_flag_reason TEXT;

-- Status enum gains 'flagged_for_rereview' (when Lead flags a tier-1 action)
-- The form_submission_documents.status CHECK constraint (existing) needs to be
-- expanded. Implementation: drop and recreate constraint with the new value.
ALTER TABLE public.form_submission_documents
  DROP CONSTRAINT IF EXISTS form_submission_documents_status_check;
ALTER TABLE public.form_submission_documents
  ADD CONSTRAINT form_submission_documents_status_check
  CHECK (status IN (
    'missing', 'submitted', 'approved', 'rejected', 'waived',
    'flagged_for_rereview'
  ));

CREATE INDEX IF NOT EXISTS idx_fsd_assigned_to
  ON public.form_submission_documents (assigned_to_user_id, status)
  WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsd_owner_review_status
  ON public.form_submission_documents (owner_review_status)
  WHERE owner_review_status IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pbv_full_applications — Application Lead
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS lead_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_assigned_by UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pbv_full_apps_lead
  ON public.pbv_full_applications (lead_user_id)
  WHERE lead_user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Convenience view for queue lookups
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.assigned_documents AS
  SELECT
    d.id AS document_id,
    d.assigned_to_user_id,
    d.assigned_at,
    d.assigned_by_user_id,
    d.doc_type,
    d.label,
    d.status,
    d.revision,
    d.owner_review_status,
    fs.id AS form_submission_id,
    pfa.id AS application_id,
    pfa.lead_user_id,
    pfa.head_of_household_name,
    pfa.building_address,
    pfa.unit_number,
    pfa.stanton_review_status
  FROM public.form_submission_documents d
  JOIN public.form_submissions fs ON fs.id = d.form_submission_id
  JOIN public.pbv_full_applications pfa ON pfa.form_submission_id = fs.id;
```

Assignment and Lead history live in `application_events`. The columns on the tables store only the **current** state. History is reconstructed by querying events.

---

## API Routes

### Per-doc assignment

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/submissions/[sid]/documents/[did]/assign` | PATCH | `isAuthenticated` | Body: `{ user_id: uuid \| null, note?: string }`. Updates the document. Writes `doc_assigned` event. Posts the Stanton-private workspace line (unless `suppress_workspace_post=true` for bulk callers). |

### Bulk doc assignment

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/submissions/documents/bulk-assign` | POST | `isAuthenticated` | Body: `{ document_ids: uuid[], user_id: uuid \| null }`. Validates that all docs belong to applications the caller can access. Writes one event per doc. Posts one summary workspace message per affected application. |

### Application Lead

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/pbv/full-applications/[id]/lead` | PATCH | `isAuthenticated` | Body: `{ user_id: uuid \| null }`. Updates `lead_user_id`. Writes `app_lead_assigned` event. Posts Stanton-private workspace message. |
| `/api/admin/pbv/full-applications/bulk-assign-lead` | POST | `isAuthenticated` | Body: `{ application_ids: uuid[], user_id: uuid \| null }`. Writes one event per app, one workspace post per app. |

### Tier-2 actions

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/submissions/[sid]/documents/[did]/lead-confirm` | POST | `isAuthenticated` + caller is the application's Lead | Sets `owner_review_status='confirmed'`. Writes `doc_owner_confirmed` event. |
| `/api/admin/submissions/[sid]/documents/[did]/lead-flag` | POST | `isAuthenticated` + caller is the application's Lead | Body: `{ reason: string }`. Sets `owner_review_status='flagged'`, doc status → `flagged_for_rereview`, captures reason. Writes `doc_owner_flagged` event. Posts Stanton-private workspace message identifying tier-1 reviewer. |

### Queue endpoints

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/me/queue` | GET | `isAuthenticated` | Returns current user's assigned docs. Query params: `status?`, `min_age_days?`. |
| `/api/admin/me/awaiting-confirmation` | GET | `isAuthenticated` | Returns docs with `owner_review_status='pending'` on apps where I'm the Lead. |
| `/api/admin/me/apps-i-lead` | GET | `isAuthenticated` | Returns apps where I'm the Lead, with per-app rollup (pending tier-1 count, pending tier-2 count, ready-to-send boolean). |

### List page

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/pbv/full-applications` | GET | `isAuthenticated` | Existing. Extended: `?assigned_to_me=true`, `?led_by_me=true`. Response rows include `lead: {user_id, display_name}` and `assignees: [{user_id, display_name, doc_count}]`. |

---

## Files Touched (Inferred — Cascade Confirms)

**NEW:**
- `supabase/migrations/20260513XXXXXX_review_workflow.sql`
- `app/api/admin/submissions/[sid]/documents/[did]/assign/route.ts`
- `app/api/admin/submissions/documents/bulk-assign/route.ts`
- `app/api/admin/pbv/full-applications/[id]/lead/route.ts`
- `app/api/admin/pbv/full-applications/bulk-assign-lead/route.ts`
- `app/api/admin/submissions/[sid]/documents/[did]/lead-confirm/route.ts`
- `app/api/admin/submissions/[sid]/documents/[did]/lead-flag/route.ts`
- `app/api/admin/me/queue/route.ts`
- `app/api/admin/me/awaiting-confirmation/route.ts`
- `app/api/admin/me/apps-i-lead/route.ts`
- `app/admin/pbv/my-work/page.tsx` — skeletal three-tab view (expanded in `workforce-dashboards`)
- `components/review/AssignDialog.tsx`
- `components/review/AssigneeBadge.tsx`
- `components/review/LeadBadge.tsx`
- `components/review/AssignLeadDialog.tsx`
- `components/review/FlagDocDialog.tsx`
- `components/review/BulkActionBar.tsx`
- `components/review/SelectableRow.tsx` (provides the checkbox)
- `__tests__/review-workflow.test.ts`

**MODIFIED:**
- `components/review/DocumentRow.tsx` — assignee badge + selection checkbox + tier-2 status badge + Confirm/Flag buttons for Lead + flag-reason inline display
- `components/review/StantonReviewSurface.tsx` — wires bulk selection, dialogs, `C` shortcut, lead actions
- `components/review/useReviewKeyboardShortcuts.ts` — adds `C` for claim; possibly `F` for flag when focused doc is in `pending` tier-2 state
- `app/admin/pbv/full-applications/[id]/page.tsx` — Application Lead chip in header, "Change Lead" affordance, gates the Send-to-HACH preflight rendering on tier-2 state
- `app/admin/pbv/full-applications/page.tsx` — bulk selection, "Assign Lead to selected…" action bar, "My docs only" + "I lead" filter pills, lead chips on rows
- `app/api/admin/pbv/full-applications/route.ts` — `assigned_to_me`, `led_by_me` filters; lead and assignees in response
- `app/api/admin/pbv/full-applications/[id]/preflight/route.ts` (from PRD I) — adds the tier-2 check when app has a Lead
- `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts` (from PRD I) — accepts the override for the new check when applicable
- `lib/events/application-events.ts` — adds `doc_assigned`, `app_lead_assigned`, `doc_owner_confirmed`, `doc_owner_flagged` event types

---

## Implementation Phases

Two phases. Phase 1 is independently useful; Phase 2 layers tier-2 on top.

### Phase 1 — Assignment and bulk operations

Deliverables:
- Migration adding `assigned_to_user_id` + `assigned_at` + `assigned_by_user_id` on documents, and the convenience view (the tier-2 columns and Lead columns can also land in this migration, just unused yet — simpler than two migrations).
- Per-doc Assign dialog + badge + `C` shortcut.
- Bulk doc assignment via checkboxes + action bar.
- Per-doc and bulk APIs.
- `/admin/pbv/my-work` page with one tab ("Assigned docs") active.
- `My docs only` filter pill and assignee chips on the list page.
- Event writes for `doc_assigned`.

After Phase 1: docs can be assigned and reassigned individually or in bulk. No tier-2 yet.

### Phase 2 — Application Lead and tier-2 confirmation

Deliverables:
- Application Lead chip in app header + Assign/Change dialog.
- Bulk Application Lead assignment on the list page.
- `flagged_for_rereview` status added to enum; tier-2 confirm/flag APIs.
- Confirm/Flag buttons on doc rows for the application Lead.
- `Awaiting my confirmation` and `Apps I lead` tabs in `/admin/pbv/my-work`.
- Send-to-HACH preflight integration (PRD I update).
- `I lead` filter pill + lead chips on list page.
- Event writes for `app_lead_assigned`, `doc_owner_confirmed`, `doc_owner_flagged`.

Both phases together land before `workforce-dashboards` begins, because that PRD's panels aggregate over both layers.

---

## Out of Scope

- Notifications outside the workspace (email, SMS, push) — handled in a later notifications PRD.
- Multi-assignee per doc, multi-Lead per app.
- "Read-only spectator" assignments (cc someone without putting them in a queue).
- Auto-suggested Lead (workload-balanced, round-robin, etc.). Manual only.
- Lead handoff workflow ("Tess hands off to Kristine while she's out") beyond simple reassignment.
- Cross-app bulk actions ("assign all the income docs in these 5 apps to Dan" — composed action that crosses both selection types). Possible later if real users ask.
- Per-category bulk assign that crosses applications. v1 bulk-assign is one application or one selection from the docs list page.
- Tier-3 review (manager confirms Lead's confirmations). Hierarchy stops at tier-2.
- Auto-confirmation rules ("Tess's approvals don't need tier-2 confirmation"). All tier-1 decisions on Lead-assigned apps go through tier-2.

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Assignee or Lead is deactivated in `admin_users` | `ON DELETE SET NULL` on FKs; UI falls back to "Unassigned" / "No Lead." History preserved in events. |
| Two users claim the same doc simultaneously | Last write wins on the column. Both events recorded. Workspace post for the loser still surfaces the conflict. |
| Bulk assignment to a user who is deactivated mid-operation | Individual rows fail; the route returns per-row outcomes. UI shows "Assigned 12/14; 2 failed: user inactive." |
| Lead is also the tier-1 reviewer (Goal #2 / Open Q #2 confirmed) | Tier-1 status flip still triggers `owner_review_status='pending'`. UI shows an inline "Confirm as Lead" shortcut on rows where the current user just acted as tier-1 and is also the Lead. One click completes tier-2 without a separate visit. |
| Lead flags Allan's approval; Allan flags it right back | Cycles are allowed but each cycle writes a flag event. The workspace channel becomes the deliberation surface — flag-pingpong is socially expensive, which is the right disincentive. |
| Lead leaves Stanton; their flagged docs sit in `flagged_for_rereview` indefinitely | Tier-1 reviewer can still act on the doc (the flag is advisory). On re-action, `owner_review_status` flips to `'pending'` and surfaces on the *new* Lead's queue (if reassigned). If no Lead is assigned, tier-2 is skipped. |
| Tier-1 reviewer overrides Lead's flag without addressing the reason | The flag reason stays visible in the row's flag-reason inline display until the doc is again confirmed by the Lead. The workspace message also remains in the channel. Acceptable; this is social enforcement, not technical. |
| Bulk-assign 200 docs to one user; their queue becomes unworkable | Soft warning at 50+; reviewer can bulk-reassign back if overwhelmed. No system-level cap. |
| Application has many concurrent leads over its lifetime (lead changed often) | `lead_user_id` is current; events table preserves the full lead-assignment history. The "Awaiting my confirmation" queue belongs to the *current* Lead only. |
| A bulk assignment partially succeeds (some docs were locked due to packet_locked from PRD I) | Locked docs are skipped; route response details which were skipped and why. UI surfaces a summary toast. |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. Should bulk assignment skip docs that are already assigned, or overwrite? | Alex | Overwrite. Bulk is decisive; users who want to be careful can use individual assign. |
| 2. Should "Apps I lead" panel show finished apps (already executed) or only in-flight? | Alex | In-flight only by default. Toggle to show all. |
| 3. Should the `lead_user_id` be auto-populated from the staff member who created the application? | Alex | No — explicit assignment only. Avoids implicit ownership. |
| 4. Should there be a quick "self-assign as Lead" affordance on the app header? | Alex | Yes — "Assign to me" appears in the Lead dialog as a one-click option. |
| 5. Should flagged docs reappear in the tier-1 assignee's queue automatically? | Alex | Yes — if a doc has a tier-1 assignee, the flag puts it back in that person's queue (status `flagged_for_rereview`). If no tier-1 assignee, it joins the general unassigned pool. |

---

## Acceptance Criteria

**Phase 1:**
- [ ] Migration applies cleanly; all columns and the view exist; the new status enum value is rejected at this point (Phase 2 enables it).
- [ ] Individual Assign dialog operates on a doc row; assignment persists; badge appears.
- [ ] Bulk action bar appears when at least one doc is selected; assigning N docs writes N events.
- [ ] `C` shortcut claims the focused doc.
- [ ] `/api/admin/me/queue` returns the user's assigned docs, filterable by status and age.
- [ ] `/admin/pbv/my-work` renders "Assigned docs" tab with correct contents.
- [ ] `/admin/pbv/full-applications?assigned_to_me=true` filters correctly; assignee chips render.
- [ ] HACH UI surfaces show no trace of assignment data (HACH payload allowlist test still passes).
- [ ] No existing review action regresses.

**Phase 2:**
- [ ] Application Lead chip renders in app header; Assign/Change dialog works; bulk-assign Lead works on list page.
- [ ] When app has a Lead, tier-1 actions on its docs flip `owner_review_status` to `'pending'`.
- [ ] Lead's Confirm button sets `'confirmed'`; Flag button requires reason and sets `'flagged'` + status `flagged_for_rereview`.
- [ ] Workspace messages post correctly for assignment, flag, and confirm events (per-doc for individual actions; one summary per app for bulk).
- [ ] `/api/admin/me/awaiting-confirmation` and `/api/admin/me/apps-i-lead` return correct data.
- [ ] Send-to-HACH preflight in PRD I correctly adds the tier-2 check when app has a Lead; override path still works.
- [ ] Lead's "Confirm as Lead" inline shortcut appears on rows where they just acted as tier-1.
- [ ] Manual walkthrough: Kristine assigns herself as Lead on an app; Allan approves the income docs; Kristine sees "Awaiting my confirmation" populate; she confirms two and flags one with a reason; Allan sees the flagged doc back in his queue with the reason inline; Allan re-reviews; Kristine confirms; the Send-to-HACH preflight now reports green and the packet is sent.
