# Workforce Dashboards — PRD

**Status:** Draft — ready for review
**Date:** 2026-05-13
**Depends on:** `stanton-workspace-document-lifecycle` (events feed) AND `per-document-assignment` (assignments to roll up against)
**Blocks:** `post-approval-execution` does not depend on this, but the dashboard will likely surface execution state once that PRD lands.

---

## Problem Statement

Stanton's PBV workflow involves multiple applications at different stages, documents arriving at unpredictable times, multiple reviewers working in parallel, and a constant risk that something goes stale because nobody noticed. The existing `/admin/pbv/pipeline` page is per-application — it answers "what's the state of THIS application" — but cannot answer the questions a working reviewer or manager actually has at the start of their day:

**A reviewer's day starts with:**
- What am I supposed to look at today?
- Where are the fresh items I should pick up before they go cold?
- What did I touch yesterday that's still on my plate?

**A manager's day starts with:**
- Who's underwater and needs help?
- Is anything aging dangerously?
- Are we going to miss a move-in date?
- Did anyone override a Send-to-HACH pre-flight check recently?

This PRD adds two views on top of the existing event feed + assignment model: **My Work** (everyone has one) and **Team Rollup** (managers have one). They share the same underlying data and the same page; tabs gate visibility.

Both views are designed to be **decision-driven** — every panel maps to a specific action the user might take from it. Panels that don't answer "what should I do next" don't ship.

---

## Goals

1. Every Stanton user gets a "My Work" view that surfaces their own queue and recent activity on apps they touch.
2. Users with elevated permission get a "Team Rollup" view that surfaces workload distribution, aging, bottlenecks, and at-risk applications.
3. Every panel is anchored to a concrete decision. Vanity metrics are explicitly out of scope.
4. The pages read from `application_events`, `form_submission_documents`, and `pbv_full_applications`. No new substrate tables.
5. Reasonable performance (sub-1-second load) on the current dataset; no aggressive caching layer in v1.

---

## Users & Roles

| Role | My Work | Team Rollup |
|---|---|---|
| Any Stanton admin user | Yes | — |
| Stanton role with `pbv-full-applications:view_team_rollup` permission | Yes | Yes |
| HACH | — | — |
| Tenant | — | — |

The new permission is assigned at deploy time, the same pattern as `read_ssn` and `send_to_hach`.

---

## Core Features

### Page structure

A new page at `/admin/pbv/work` with two tabs:
- **My Work** (default for everyone)
- **Team Rollup** (only visible to users with the permission)

The existing `/admin/pbv/my-work` page (skeletal from the assignment PRD) is moved into this page as the first panel of "My Work."

### My Work — panels

Each panel answers one question. Each row in each panel is clickable and takes you to the corresponding doc or application surface.

**1. My queue (assigned docs)**

The first surface — direct reuse from the assignment PRD. Lists the current user's assigned docs across all applications, sorted by age. Filter pills: All / Awaiting review / Resubmitted / Aging (>3 days) / Flagged for re-review.

Decision it supports: "What should I review next?"

**1a. Awaiting my confirmation (Application Lead queue)**

Docs with `owner_review_status='pending'` on apps where I'm the Application Lead. The tier-2 queue. Shows the tier-1 reviewer's decision, who made it, and when. Quick Confirm and Flag buttons inline; clicking the row opens the full doc viewer.

Decision it supports: "What tier-1 reviews am I responsible for signing off on?"

**1b. Apps I lead**

Applications where I'm the Application Lead, with per-app rollup: tier-1 pending count, tier-2 pending count, ready-to-send indicator. Sorted by ready-to-send first, then by tier-2 pending count.

Decision it supports: "Which of my packets are ready to push to HACH, and which still need work?"

**2. Fresh activity on my apps**

Lists events from the last 48 hours on applications where the current user has any assigned doc, OR was the most recent Stanton reviewer of any doc. Event types shown: `doc_uploaded` (especially staff/tenant), `doc_recategorized`, `shared_workspace_messages` (from HACH on apps I'm on), `hach_approved` / `hach_rejected` (when PRD IV lands, this surfaces here).

Decision it supports: "What just changed that I need to react to?"

**3. Stale apps I touched**

Lists applications where the user took the most recent Stanton action but the app has had no movement in 7+ days. Each row shows the days-stale count and the suspected blocker (tenant, HACH, internal — derived from the last event).

Decision it supports: "What did I drop the ball on?"

**4. Recently completed**

Last 10 documents the user approved, rejected, or waived. Shown for satisfaction and reference, not action.

Decision it supports: "What did I do yesterday?" (Also useful for the optional standup skill.)

### Team Rollup — panels

**1. Workload by reviewer**

Table: each Stanton user, columns for:
- Currently assigned docs (count, with status breakdown)
- Avg age of their assignments
- Docs reviewed in last 7 days (throughput)
- Last activity timestamp

Decision it supports: "Who needs help / who has capacity?"

Action: click a row to view their queue (read-only).

**2. Bottlenecks**

A pivot of `pbv_full_applications` by `stage`, counting applications in each stage and showing average days-in-stage. Highlight stages above an aging threshold (default: stanton_review > 5 days, hach_review > 14 days, others > 10 days).

Decision it supports: "Where is the workflow backing up?"

Action: click a stage to drill into the applications stuck there.

**3. At-risk applications**

Applications with a move-in target date in the next 14 days that are not yet in stage `approved` or further. Sorted by date.

[Inference] Move-in target may not be in the schema today. If not, this panel surfaces "applications in stage `submitted_to_hach` or `hach_review` for more than X days" as a fallback. The actual move-in date plumbing is added by a separate small migration if needed and confirmed during build.

Decision it supports: "What is at risk of slipping a move-in commitment?"

**4. Recent overrides**

Applications submitted to HACH with override flags from PRD #1. Shows date, submitter, override reason, and which checks were overridden.

Decision it supports: "Should I review whether this packet should have gone out?"

**5. Doc age distribution**

A simple histogram of documents in `submitted` status by age in days. Buckets: 0–1, 2–3, 4–7, 8–14, 15+. Each bucket count is clickable to drill into that bucket.

Decision it supports: "Are we keeping up with intake volume?"

**6. Apps without a Lead**

In-flight applications (stage between `stanton_review` and `submitted_to_hach`) where `lead_user_id IS NULL`. Sorted by oldest stage entry first.

Decision it supports: "Which packets need a Lead assigned before they advance?"

**7. Tier-2 confirmation backlog**

Applications where tier-1 review is complete on most or all docs but the Lead hasn't yet confirmed. Surfaces apps that are technically "done" but stuck in the Lead's queue.

Decision it supports: "Which Leads are overloaded, and which apps are stuck waiting on confirmation?"

### Cross-cutting

- Both views default to the current week. A small date picker in the top-right lets the user shift the window (back 1 week, back 1 month, custom range).
- Every panel has a "Refresh" button. No auto-polling in v1.
- Every clickable row lands on the relevant doc or application, with the focused row scrolled into view.

---

## Data Model

No new tables. All panels read from existing data:

- `application_events` — for fresh activity, throughput, recently completed, recent overrides.
- `form_submission_documents` (and the `assigned_documents` view from PRD II) — for my queue, workload by reviewer, doc age distribution.
- `pbv_full_applications` — for bottlenecks, at-risk.
- `pbv_pipeline_stage_columns` (existing migration) — stage and days-in-stage.

Permission seed:

```sql
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'view_team_rollup')
ON CONFLICT DO NOTHING;
```

[Inference] If move-in target date is not currently on `pbv_full_applications`, a small migration adds `target_move_in_date DATE NULL`. To be confirmed at build time. The at-risk panel falls back to stage-age if the column doesn't exist.

---

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/me/work/fresh-activity` | GET | `isAuthenticated` | Returns events from the last 48h on apps the user is involved in. |
| `/api/admin/me/work/stale-touched` | GET | `isAuthenticated` | Returns apps where the user is the last actor and no activity in 7+ days. |
| `/api/admin/me/work/recently-completed` | GET | `isAuthenticated` | Returns the user's last 10 review actions. |
| `/api/admin/pbv/rollup/workload` | GET | `isAuthenticated` + `view_team_rollup` | Workload by reviewer table. |
| `/api/admin/pbv/rollup/bottlenecks` | GET | same | Stage-by-stage counts and aging. |
| `/api/admin/pbv/rollup/at-risk` | GET | same | Apps within the move-in window or stage-aged. |
| `/api/admin/pbv/rollup/overrides` | GET | same | Recent overrides (last 30 days default). |
| `/api/admin/pbv/rollup/doc-age` | GET | same | Histogram buckets for `submitted` docs by age. |

Each endpoint accepts a `range` query param (`week` | `month` | `custom` with `from` / `to`) where applicable.

---

## Files Touched (Inferred — Cascade Confirms)

**NEW:**
- `app/admin/pbv/work/page.tsx` — top-level page with the two tabs
- `app/admin/pbv/work/MyWork.tsx` — composition of the My Work panels
- `app/admin/pbv/work/TeamRollup.tsx` — composition of the Team Rollup panels
- `app/admin/pbv/work/panels/MyQueue.tsx`
- `app/admin/pbv/work/panels/FreshActivity.tsx`
- `app/admin/pbv/work/panels/StaleTouched.tsx`
- `app/admin/pbv/work/panels/RecentlyCompleted.tsx`
- `app/admin/pbv/work/panels/WorkloadByReviewer.tsx`
- `app/admin/pbv/work/panels/Bottlenecks.tsx`
- `app/admin/pbv/work/panels/AtRisk.tsx`
- `app/admin/pbv/work/panels/RecentOverrides.tsx`
- `app/admin/pbv/work/panels/DocAgeDistribution.tsx`
- `app/api/admin/me/work/[panel]/route.ts` — single dynamic handler for the user-scoped panels OR five separate route files (Cascade decides)
- `app/api/admin/pbv/rollup/[panel]/route.ts` — same for rollup endpoints
- `lib/work/queries.ts` — shared query helpers (typed)
- `__tests__/work-rollup.test.ts`

**MODIFIED:**
- `lib/adminNav.ts` — add "Work" entry to admin nav; remove the standalone "My Work" entry from PRD II (now a tab inside the unified page)
- `app/admin/pbv/my-work/page.tsx` — redirect to `/admin/pbv/work` (preserved as a permalink)

---

## Implementation Phases

Single phase, single PR.

Order of build within the phase:
1. API endpoints first, with tests against seeded data.
2. Page skeleton with empty panels.
3. Wire panels one at a time. Each panel ships as a standalone diff inside the PR; halt and review if any panel produces unexpected aggregates.
4. Permission gating on Team Rollup.

---

## Out of Scope

- Auto-refresh / live data. Manual refresh button only.
- Customizable panels, saved views, panel reordering.
- Export to CSV / PDF.
- Cross-program comparisons (PBV vs. other programs).
- Notifications when something hits a threshold (e.g., "Tess just got her 20th doc"). Out of scope.
- Predictive forecasting / capacity planning.
- Per-user "personal dashboard" customization.
- Historical trend charts (week-over-week, month-over-month). The data exists in `application_events` but visualizing it is Phase 2.
- Drilling from the rollup directly into another user's queue with edit affordances. Read-only drill-in only.

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Panels return vanity numbers that don't drive decisions | Every panel description above includes an explicit decision. Anything that doesn't map to one gets cut before build. |
| Slow queries on `application_events` as it grows | Indexes from PRD #1 cover the access patterns (by application, by actor, by event type, by created_at). At anticipated volume, no caching needed. Revisit at 1M events. |
| Team Rollup becomes a surveillance tool | The framing in the UI is workload distribution, not performance management. No "leaderboards." Throughput is shown for capacity planning, not ranking. Document this in the page header copy. |
| Throughput rewards reviewing easy docs | Acknowledged. Throughput counts are advisory. We don't act on them; managers do, with judgment. |
| At-risk panel false-positives when move-in date is informal / wrong | The panel shows the source (target date or stage age). Managers read it with context. |
| Doc-age histogram lumps tenant-uploaded and staff-uploaded together | Toggle pills on the panel: All / Tenant-uploaded / Staff-uploaded / HACH-uploaded. Each bucket clickable to drill in. |
| Overrides panel shames the override user | Frame as audit, not blame. Show the reason verbatim. The point is for managers to ask "should we have shipped that?", not "Tess, why did you override?" |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. Should `target_move_in_date` be added now or wait until it's actually populated? | Alex | Add the column now (nullable) so the at-risk panel can read it; populate it via a small intake-form addition in a follow-up. Until populated, at-risk falls back to stage-age. |
| 2. Should the Team Rollup tab be the default for users who have permission? | Alex | No — default to My Work for everyone. People work first, manage second. |
| 3. Should aging thresholds (5 days, 14 days, etc.) be configurable per-deploy or hardcoded? | Alex | Hardcoded constants in `lib/work/queries.ts`. Make configurable when somebody asks. |
| 4. Should the Bottlenecks panel show stages in chronological order or by severity? | Alex | Chronological (intake → stanton_review → submitted_to_hach → hach_review → approved). Easier to read. Severity is visible via color. |
| 5. Should "My Work" show docs assigned to me, or also docs on apps where I'm the last actor (even unassigned)? | Alex | Only assigned docs in "My queue." Apps where I'm the last actor live in "Stale apps I touched." Keep them separate so the queue stays clean. |

---

## Acceptance Criteria

- [ ] `/admin/pbv/work` page renders with two tabs; non-permissioned users see only "My Work."
- [ ] All five My Work panels render with correct data for the seeded test fixtures.
- [ ] All five Team Rollup panels render with correct data; visible only to users with the permission.
- [ ] Date-range picker affects panels that accept it (fresh activity, throughput, recently completed, overrides).
- [ ] Clicking any row in any panel navigates to the relevant doc or application, scrolled into view.
- [ ] Refresh button re-fetches all panels on the current tab.
- [ ] Permission seed exists and is enforced on rollup endpoints.
- [ ] HACH UI surfaces show no trace of Stanton work-rollup data (allowlist test still passes).
- [ ] Page loads under 1 second on the current dataset (manual measurement).
- [ ] No existing surfaces regress.
- [ ] Manual walkthrough: Tess opens her queue, picks up the oldest doc, reviews it, refreshes the page, the doc has moved out of "Awaiting review" into "Recently completed." Kristine opens Team Rollup, sees Tess's throughput, sees one application in stanton_review aging past 5 days, drills in to investigate.
