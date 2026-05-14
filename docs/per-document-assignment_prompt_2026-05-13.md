# Windsurf Prompt — Review Workflow (Assignment, Bulk, Application Lead)

**PRD:** `docs/per-document-assignment_prd_2026-05-13.md` (read end-to-end; note the PRD title is "Review Workflow — Assignment, Bulk Operations, Application Lead" — the filename stayed for cross-reference stability)
**Build report:** `docs/build-reports/review-workflow_build-report_2026-05-13.md`
**Depends on:** `stanton-workspace-document-lifecycle` (both phases) merged. Specifically: `application_events` table exists, `lib/events/application-events.ts` exists, the events helper's transaction-required contract is in place. If not, **STOP and report**.
**Blocks:** `workforce-dashboards` (PRD III)

---

## Execution mode

**Use the goal skill.** Execute Phase 1 (assignment + bulk) and Phase 2 (Lead + tier-2) end-to-end without asking Alex to confirm between them. Auto-proceed once Phase 1 gates pass. **Stop only if:** a verification gate fails, a Hard NO is hit, a Required-reading file is missing, or you encounter ambiguity not resolved by the PRD.

When you stop, write a short summary of *what specifically failed* and *what you need from Alex*. Do not retry blindly.

---

## Context

You are introducing per-document assignment, bulk assignment, the Application Lead concept, and the tier-2 confirmation flow. The Application Lead is the person accountable for a packet ship-ready — when set, every tier-1 review (approve/reject/waive) requires a tier-2 confirmation by the Lead before the packet can be Sent to HACH.

This PRD is what enables `workforce-dashboards` — those panels read assignment and Lead state from here.

---

## Required reading before you start

1. **`docs/per-document-assignment_prd_2026-05-13.md`** — every section.
2. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — the events feed and lock semantics.
3. **`lib/events/application-events.ts`** — the helper you'll extend with new event types.
4. **`components/review/StantonReviewSurface.tsx`** — the review surface to extend with selection + bulk actions + Lead UI.
5. **`components/review/DocumentRow.tsx`** — gains checkbox, assignee badge, tier-2 status, Confirm/Flag buttons.
6. **`app/admin/pbv/full-applications/[id]/page.tsx`** — gains Application Lead chip in the header.
7. **`app/admin/pbv/full-applications/page.tsx`** — gains row checkboxes, bulk-action bar, filter pills, lead chips.
8. **`app/api/admin/pbv/full-applications/[id]/preflight/route.ts`** (from PRD I) — extend with the tier-2 check.
9. **`app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`** (from PRD I) — accept the new override key.
10. **`supabase/migrations/20260423210000_pbv_full_application_tables.sql`** — schema of `pbv_full_applications`.
11. **`supabase/migrations/`** — locate the migration defining the `form_submission_documents.status` CHECK constraint. You will be modifying it to add `flagged_for_rereview`.
12. **`lib/auth.ts`** — session/user shape; admin-user picker queries.
13. **`lib/hach/payload-filter.ts`** — confirm none of the new columns leak through HACH endpoints.

---

## Build

### Phase 1 — Assignment and bulk

**Step 1 — Migration**

Create `supabase/migrations/20260513XXXXXX_review_workflow.sql`. The migration covers BOTH phases at the data level (simpler than two migrations); UI for Phase 2 features lands in Phase 2's UI step.

Includes:
- All assignment columns + tier-2 columns + Lead columns + status enum expansion + the `assigned_documents` view, exactly as in the PRD's data model section.
- Drop and recreate the `form_submission_documents_status_check` constraint to add `flagged_for_rereview`.
- Indexes per the PRD.

**Step 2 — Event types**

Extend `lib/events/application-events.ts`:
- Add new event types: `doc_assigned`, `app_lead_assigned`, `doc_owner_confirmed`, `doc_owner_flagged`.
- Add typed metadata helpers for each event type.

**Step 3 — Per-doc assignment API**

Create `app/api/admin/submissions/[sid]/documents/[did]/assign/route.ts`:
- PATCH. Body: `{ user_id: uuid | null, note?: string }`.
- Validates `user_id` if non-null is an active admin user.
- Updates `assigned_to_user_id`, `assigned_at`, `assigned_by_user_id`.
- Writes `doc_assigned` event with `from_user_id` (previous) and `to_user_id` (new).
- Posts a Stanton-private workspace message: "Maria K. assigned 'Birth Certificate — Sofia Martinez' to Dan F."
- Accepts a `suppress_workspace_post=true` query param used by bulk callers.

**Step 4 — Bulk doc assignment API**

Create `app/api/admin/submissions/documents/bulk-assign/route.ts`:
- POST. Body: `{ document_ids: uuid[], user_id: uuid | null }`.
- Validates every document exists and is accessible.
- For each doc: same logic as individual assign, but with `suppress_workspace_post`.
- After all individual writes: post **one summary** workspace message per affected application: "Tess assigned 14 docs to Dan."
- Returns per-row outcomes (`{ id, ok: true }` or `{ id, ok: false, reason }`).

**Step 5 — Queue API**

Create `app/api/admin/me/queue/route.ts`:
- GET. Returns the user's assigned documents (querying the `assigned_documents` view).
- Query params: `status?` (single value or comma-separated list), `min_age_days?`.

**Step 6 — UI: per-doc Assign**

Build `components/review/AssignDialog.tsx`:
- User picker (autocomplete over active admin users).
- "Assign to me" quick action.
- "Unassign" (when currently assigned).
- Optional note textarea.

Build `components/review/AssigneeBadge.tsx`:
- Initials in a small circle; tooltip with full name + assignment date.
- "Assign" link when no assignee.

Modify `components/review/DocumentRow.tsx`:
- Adds the assignee affordance to the right of the doc label.
- Adds a row checkbox on the left edge (Step 7 wires the selection state).

**Step 7 — UI: bulk doc assignment**

Build `components/review/SelectableRow.tsx` (the checkbox primitive).
Build `components/review/BulkActionBar.tsx`:
- Floating action bar at the bottom of `StantonReviewSurface` when ≥1 doc is selected.
- Shows count, "Assign selected to…" action.
- Soft confirm when count ≥ 50.

Modify `components/review/StantonReviewSurface.tsx`:
- Manages selection state (set of selected doc IDs).
- Renders header checkbox per category ("select all in category").
- Wires the BulkActionBar and AssignDialog.

**Step 8 — Keyboard shortcut: `C` claim**

Modify `components/review/useReviewKeyboardShortcuts.ts`:
- Adds `C` — assigns the focused doc to the current user (no dialog).
- Bails when focus is in a text input.

**Step 9 — My Work page (skeletal)**

Create `app/admin/pbv/my-work/page.tsx`:
- Three tabs declared, only "Assigned docs" populated in Phase 1.
- "Assigned docs" tab shows the current user's queue grouped by application, sorted by age.
- Filter pills: All / Awaiting review / Resubmitted / Aging (>3 days).

**Step 10 — List page additions**

Modify `app/admin/pbv/full-applications/page.tsx`:
- Adds `My docs only` filter pill.
- Adds assignee chip per row (up to three initials, +N overflow).

Modify `app/api/admin/pbv/full-applications/route.ts`:
- Accepts `?assigned_to_me=true` filter.
- Response rows include `assignees: [{user_id, display_name, doc_count}]`.

**Step 11 — Phase 1 tests**

Create `__tests__/review-workflow-phase1.test.ts`:
1. Individual assign writes a `doc_assigned` event and updates the row.
2. Bulk assign of 14 docs writes 14 events but ONE workspace message per application.
3. Bulk assign with a deactivated user returns per-row failures; partial success is OK.
4. `C` shortcut claims the focused doc.
5. `/api/admin/me/queue` returns only the calling user's docs.
6. List page assignee chips correctly aggregate counts.
7. HACH payload-filter test still passes (no assignment leakage).

**Step 12 — Phase 1 verification gates**

- `npm run build` — zero errors.
- `npm test` — all green.
- TypeScript strict — clean.
- Manual: assign a doc, bulk-assign 5 docs to a different user, verify queue and badges.

If all gates pass, **auto-proceed to Phase 2.**

---

### Phase 2 — Application Lead and tier-2 confirmation

**Step 13 — Application Lead API**

Create `app/api/admin/pbv/full-applications/[id]/lead/route.ts`:
- PATCH. Body: `{ user_id: uuid | null }`.
- Updates `lead_user_id`, `lead_assigned_at`, `lead_assigned_by`.
- Writes `app_lead_assigned` event with `from_user_id` / `to_user_id`.
- Posts Stanton-private workspace message: "Kristine assigned Tess as Application Lead."

Create `app/api/admin/pbv/full-applications/bulk-assign-lead/route.ts`:
- POST. Body: `{ application_ids: uuid[], user_id: uuid | null }`.
- One event per app, one workspace post per app.
- Returns per-app outcomes.

**Step 14 — Tier-2 confirm + flag**

Create `app/api/admin/submissions/[sid]/documents/[did]/lead-confirm/route.ts`:
- POST. Auth: `isAuthenticated` + caller is the application's current Lead (else 403).
- Sets `owner_review_status='confirmed'`, `owner_reviewed_at=NOW()`, `owner_reviewed_by=user`.
- Writes `doc_owner_confirmed` event.

Create `app/api/admin/submissions/[sid]/documents/[did]/lead-flag/route.ts`:
- POST. Auth: same.
- Body: `{ reason: string }` (required, non-empty).
- Sets `owner_review_status='flagged'`, `owner_flag_reason=reason`, status `flagged_for_rereview`.
- Writes `doc_owner_flagged` event with reason and the prior tier-1 actor in metadata.
- Posts Stanton-private workspace message naming both parties: "Tess flagged Allan's approval of 'Pay Stub — Sofia Martinez' for re-review. Reason: pay period is wrong."

**Step 15 — Tier-2 trigger on existing review actions**

Modify `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts`, `reject/route.ts`, `waive/route.ts`:
- After the tier-1 status write, check if the app has a Lead.
- If yes: set `owner_review_status='pending'` in the same transaction.
- This MUST be additive — do not break PRD I's `application_events` writes; the tier-2 state flip is a separate column update inside the same transaction.

**Step 16 — Queue endpoints for Lead surfaces**

Create `app/api/admin/me/awaiting-confirmation/route.ts`:
- GET. Returns docs with `owner_review_status='pending'` on apps where the calling user is the Lead.

Create `app/api/admin/me/apps-i-lead/route.ts`:
- GET. Returns apps where the calling user is the Lead.
- For each app, includes rollup: `pending_tier1_count`, `pending_tier2_count`, `ready_to_send: bool` (all required docs approved/waived AND all tier-1-reviewed docs tier-2-confirmed AND `stanton_review_status='approved'` AND HHA generated).

**Step 17 — UI: Lead in app header**

Build `components/review/LeadBadge.tsx`:
- Avatar + name when Lead set; "Assign Lead" affordance when empty.

Build `components/review/AssignLeadDialog.tsx`:
- User picker, "Assign to me," "Remove Lead."

Modify `app/admin/pbv/full-applications/[id]/page.tsx`:
- Renders LeadBadge in the header.
- Opens AssignLeadDialog on click.

**Step 18 — UI: tier-2 row controls**

Modify `components/review/DocumentRow.tsx`:
- When the current user is the application Lead AND `owner_review_status='pending'`: render **Confirm** and **Flag** buttons inline.
- When `owner_review_status='confirmed'`: small "Confirmed by [Lead] on [date]" indicator.
- When `owner_review_status='flagged'`: red banner row showing the flag reason inline, "Flagged by [Lead] on [date]."

Build `components/review/FlagDocDialog.tsx`:
- Required reason textarea.
- "Flag" / "Cancel."

**Step 19 — Lead-as-tier-1 inline shortcut**

In `StantonReviewSurface`: when the current user just took a tier-1 action on a doc AND they are the application Lead, render a one-click **"Confirm as Lead"** affordance on the row for the next ~10 seconds (or until they navigate away). Click calls the lead-confirm endpoint.

**Step 20 — My Work — Phase 2 tabs**

Modify `app/admin/pbv/my-work/page.tsx`:
- Populate the "Awaiting my confirmation" tab — calls `/api/admin/me/awaiting-confirmation`. Inline Confirm + Flag buttons.
- Populate the "Apps I lead" tab — calls `/api/admin/me/apps-i-lead`. Each app card shows the rollup counts and ready-to-send indicator.

**Step 21 — List page additions**

Modify `app/admin/pbv/full-applications/page.tsx`:
- Adds `I lead` filter pill.
- Adds Lead chip per row (single avatar, tooltip).
- Adds bulk action: when multiple apps selected, show "Assign Lead to selected…" in the bulk action bar.

Modify `app/api/admin/pbv/full-applications/route.ts`:
- Accepts `?led_by_me=true` filter.
- Response rows include `lead: {user_id, display_name}`.

**Step 22 — PRD I preflight integration**

Modify `app/api/admin/pbv/full-applications/[id]/preflight/route.ts` (created in PRD I):
- Add a fourth check that runs only when `lead_user_id IS NOT NULL`: every tier-1-reviewed doc (`status IN approved/rejected/waived`) has `owner_review_status='confirmed'`.

Modify `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`:
- Accepts the new override key in `override_failed_checks` (e.g., `tier2_confirmation`).
- No code logic change for the action itself — just acknowledges the new check exists in the override path.

**Step 23 — Phase 2 tests**

Create `__tests__/review-workflow-phase2.test.ts`:
1. Setting a Lead writes `app_lead_assigned` event and posts workspace message.
2. Tier-1 approve on a Lead-assigned app flips `owner_review_status` to `pending` atomically.
3. Lead Confirm sets `confirmed`; non-Lead Confirm returns 403.
4. Lead Flag requires reason; sets status `flagged_for_rereview`; flag reason persists.
5. Workspace message on flag identifies both Lead and prior tier-1 actor.
6. After flag, tier-1 reviewer re-approves → `owner_review_status` flips back to `pending`.
7. "Confirm as Lead" inline shortcut works when same user does tier-1 then tier-2.
8. PRD I preflight returns failure on tier-2 check when app has Lead and some docs pending; passes when all confirmed; passes when app has no Lead.
9. Override path on Send-to-HACH still works with the new check.
10. HACH allowlist still passes — no `lead_user_id`, no `owner_review_status` leaks.

**Step 24 — Phase 2 verification gates**

- `npm run build` — zero.
- `npm test` — green.
- Manual end-to-end (the Walkthrough from the PRD's acceptance criteria):
  - Kristine assigns herself as Lead on an app.
  - Allan approves the income docs (tier-1).
  - Kristine sees "Awaiting my confirmation" populate.
  - Kristine confirms two and flags one with a reason.
  - Allan sees the flagged doc back in his queue with the reason inline.
  - Allan re-reviews; Kristine confirms.
  - Send-to-HACH preflight now reports green.

If any gate fails, **stop and report**.

---

## Tech constraints

- Same as PRD I prompt: Next.js App Router, React 18+ hooks, TS strict, Supabase service-role inside routes, single-transaction multi-row writes, Vitest tests, no new deps.

---

## Hard NOs

- **Do NOT collapse tier-1 and tier-2 status into a single column.** They are independent states.
- **Do NOT auto-confirm tier-2 when the Lead is the tier-1 actor.** The inline "Confirm as Lead" shortcut is one click but it is still an explicit click and an explicit event.
- **Do NOT remove the tier-1 assignee when the Lead flags a doc.** The flag puts the doc back in the assignee's queue (with `flagged_for_rereview` state), not in the "unassigned" pool.
- **Do NOT block bulk-assignment to a deactivated user with a hard error.** Return per-row failures; partial success is acceptable.
- **Do NOT suppress workspace posts for individual assignments.** Only bulk callers suppress.
- **Do NOT introduce permissions for being a Lead.** Any admin can be assigned. The tier-2 confirm/flag endpoints check "is caller the current Lead" — no separate permission needed.
- **Do NOT modify HACH endpoints or surfaces** beyond the allowlist check.
- **Do NOT modify the tenant portal.** Out of scope.
- **Do NOT introduce real-time updates, notifications, or e-sign.** Other PRDs.
- **Do NOT add TODOs or placeholders.**

---

## Build report requirements

Create `docs/build-reports/review-workflow_build-report_2026-05-13.md` with the standard sections (PRD reference; Phase 1 + Phase 2 acceptance; files created/modified/deleted; migration verification with `\d`; event types extended; save-path registry; test output; manual walkthrough log with screenshots; HACH wall verification; deviations; pre-existing issues; final pass/fail summary).

---

## When you finish

Reply in chat with:
- Confirmation both phases completed
- Pass/fail on each verification gate (Steps 12 + 24)
- Build report path
- Anything that blocked you mid-build
- Specifically: did the tier-2 state flip correctly through every approve/reject/waive path?
- Specifically: did the flag → re-review → confirm cycle work in the manual walkthrough?
- Specifically: did the PRD I preflight integration not break anything in PRD I's existing flow?

If any verification item fails, do not declare complete.
