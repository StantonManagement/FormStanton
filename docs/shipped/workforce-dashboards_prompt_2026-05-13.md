# Windsurf Prompt — Workforce Dashboards

**PRD:** `docs/workforce-dashboards_prd_2026-05-13.md` (read end-to-end)
**Build report:** `docs/build-reports/workforce-dashboards_build-report_2026-05-13.md`
**Depends on:** `stanton-workspace-document-lifecycle` AND `per-document-assignment` (both fully merged with Phase 2 included). The events feed and the Application Lead model MUST exist. If `application_events` is empty for the test fixtures, the panels will return empty data — seed first.
**Blocks:** none

---

## Execution mode

**Use the goal skill.** Single phase. Execute end-to-end without asking Alex to confirm. **Stop only if:** a verification gate fails, a Hard NO is hit, a Required-reading file is missing, or ambiguity unresolved by the PRD.

---

## Context

You are adding two surfaces on top of the existing data: **My Work** (everyone) and **Team Rollup** (managers). Same page, two tabs. Every panel is anchored to a specific decision — if you find yourself building a panel that doesn't map to a decision, stop and reconsider.

The data already exists in `application_events`, `form_submission_documents`, `pbv_full_applications`, and the convenience views. No new substrate tables. This is a UI + query layer over what's already there.

---

## Required reading before you start

1. **`docs/workforce-dashboards_prd_2026-05-13.md`** — every section. Note especially the "decision it supports" line under each panel — that's the test for whether the panel is worth building.
2. **`docs/per-document-assignment_prd_2026-05-13.md`** — the source of assignment and Lead data.
3. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — the events feed.
4. **`app/admin/pbv/my-work/page.tsx`** — the skeletal page from PRD II that you will move into the new structure.
5. **`app/admin/pbv/pipeline/page.tsx`** — existing dashboard; reference for style and aggregation patterns.
6. **`lib/adminNav.ts`** — admin navigation registry; add the new "Work" entry; remove standalone "My Work."
7. **`supabase/migrations/`** — locate the migration adding `pbv_pipeline_stage_columns` (stages and aging logic).
8. **`lib/auth.ts`** — permission walk pattern.

---

## Build

### Step 1 — Migration

Create `supabase/migrations/20260513XXXXXX_workforce_dashboards.sql`:
- Permission seed: `INSERT INTO permissions (resource, action) VALUES ('pbv-full-applications', 'view_team_rollup') ON CONFLICT DO NOTHING`.
- **Conditional:** if `pbv_full_applications.target_move_in_date` does not exist, add it: `ALTER TABLE pbv_full_applications ADD COLUMN IF NOT EXISTS target_move_in_date DATE`. The at-risk panel reads from it; until populated, the panel falls back to stage-age.

### Step 2 — Query helpers

Create `lib/work/queries.ts`. Typed query functions, one per panel:

- `getMyQueue(userId, filters)` — assigned docs for user.
- `getAwaitingMyConfirmation(userId)` — tier-2 pending docs on apps user leads.
- `getAppsILead(userId, includeFinished)` — apps user leads with per-app rollup.
- `getFreshActivity(userId)` — last 48h events on apps user is involved with.
- `getStaleTouched(userId)` — apps where user is last actor, no movement in 7+ days.
- `getRecentlyCompleted(userId, limit)` — user's last N review actions.
- `getWorkloadByReviewer(range)` — rollup per Stanton user.
- `getBottlenecks(range)` — apps grouped by stage with age stats.
- `getAtRisk()` — apps with target_move_in_date <= 14 days from now AND not in `approved`/`executed`; falls back to stage-age if no date.
- `getRecentOverrides(rangeDays)` — apps submitted with override in last N days.
- `getDocAgeDistribution(filterByUploaderRole?)` — buckets for submitted docs.
- `getAppsWithoutLead()` — in-flight apps with `lead_user_id IS NULL`.
- `getTier2Backlog()` — apps where tier-1 is mostly/fully done but Lead hasn't confirmed.

Each function returns typed payloads. Hardcode aging thresholds as `const` exports at the top of the file (per Open Question #3 default).

### Step 3 — API routes

User-scoped (auth: `isAuthenticated`):
- `/api/admin/me/work/my-queue` — already exists from PRD II; do not modify.
- `/api/admin/me/work/awaiting-confirmation` — already exists from PRD II.
- `/api/admin/me/work/apps-i-lead` — already exists from PRD II.
- `/api/admin/me/work/fresh-activity` — new.
- `/api/admin/me/work/stale-touched` — new.
- `/api/admin/me/work/recently-completed` — new.

Rollup (auth: `isAuthenticated` + `pbv-full-applications:view_team_rollup`):
- `/api/admin/pbv/rollup/workload` — new.
- `/api/admin/pbv/rollup/bottlenecks` — new.
- `/api/admin/pbv/rollup/at-risk` — new.
- `/api/admin/pbv/rollup/overrides` — new.
- `/api/admin/pbv/rollup/doc-age` — new.
- `/api/admin/pbv/rollup/apps-without-lead` — new.
- `/api/admin/pbv/rollup/tier2-backlog` — new.

Each rollup endpoint accepts `?range=week|month|custom&from=…&to=…` where applicable.

### Step 4 — Page structure

Create `app/admin/pbv/work/page.tsx`:
- Two tabs: **My Work** (default), **Team Rollup** (visible only with permission).
- Permission check on render — if user lacks `view_team_rollup`, Team Rollup tab is not rendered.
- Date-range picker in the top-right (defaults to "this week"). Affects only panels that accept a range.
- Per-page Refresh button (re-fetches all panels on current tab).

### Step 5 — My Work composition

Create `app/admin/pbv/work/MyWork.tsx` composing panels:
- `MyQueue` (with new filter pill: Flagged for re-review)
- `AwaitingMyConfirmation`
- `AppsILead`
- `FreshActivity`
- `StaleTouched`
- `RecentlyCompleted`

Order on the page: My Queue → Awaiting Confirmation → Apps I Lead → Fresh Activity → Stale Touched → Recently Completed. Most actionable first.

### Step 6 — Team Rollup composition

Create `app/admin/pbv/work/TeamRollup.tsx` composing panels:
- `WorkloadByReviewer`
- `Bottlenecks`
- `AppsWithoutLead`
- `Tier2Backlog`
- `AtRisk`
- `RecentOverrides`
- `DocAgeDistribution`

Header note: short explanatory copy framing the rollup as workload distribution, NOT performance management. Per the PRD's risk register.

### Step 7 — Panel components

Each panel is its own file under `app/admin/pbv/work/panels/`. Use the conventions in the PRD's Files Touched section. Every panel:
- Renders the "decision it supports" copy as a tooltip/icon next to the panel title (so the reason for the panel stays visible).
- Every row is clickable; navigation lands on the relevant doc or application with the row scrolled into view.
- Empty states show a thin neutral message ("Nothing in this view right now") — no fanciness.

### Step 8 — Filter pill on existing surfaces

The "Flagged for re-review" pill belongs on `MyQueue`. Add it.

Also, on the existing `/admin/pbv/full-applications` list page, leave PRD II's filter pills alone — those are owned by PRD II.

### Step 9 — Navigation rewire

Modify `lib/adminNav.ts`:
- Add a "Work" entry pointing to `/admin/pbv/work`.
- Remove or hide the existing standalone "My Work" entry from PRD II's nav (the page itself becomes a redirect).

Modify `app/admin/pbv/my-work/page.tsx`:
- Replace contents with a redirect to `/admin/pbv/work`.
- Preserve the path as a permalink so deep links from PRD II still work.

### Step 10 — Aging thresholds

In `lib/work/queries.ts`, top-of-file constants:
```ts
export const AGING_THRESHOLDS = {
  stanton_review_days: 5,
  hach_review_days: 14,
  default_stage_days: 10,
  stale_touched_days: 7,
  at_risk_move_in_days: 14,
  doc_age_buckets: [1, 3, 7, 14],
};
```

These are read by every rollup query. Changing the constant changes the panel behavior consistently.

### Step 11 — Tests

Create `__tests__/work-rollup.test.ts`:
1. User without permission gets 403 on rollup endpoints and Team Rollup tab is not rendered.
2. User with permission sees both tabs.
3. Workload by reviewer correctly counts only active assignments (excludes finished/executed apps).
4. Bottlenecks correctly identifies stages above their threshold.
5. At-risk falls back to stage-age when `target_move_in_date` is null.
6. Overrides panel surfaces only override-flagged submissions in the date range.
7. Doc age distribution buckets sum to the total submitted-doc count.
8. Apps-without-lead excludes apps in `pre_app` / `intake` and apps already past `submitted_to_hach`.
9. Tier-2 backlog correctly identifies apps where ≥80% of docs are tier-1 reviewed but tier-2 pending count > 0.
10. HACH allowlist test still passes — no work-rollup data leaks to HACH endpoints.

### Step 12 — Verification gates

- `npm run build` — zero errors.
- `npm test` — all green, including new and pre-existing.
- TypeScript strict — clean.
- Manual: open `/admin/pbv/work` as a regular user — see My Work, six populated panels.
- Manual: open as a user with `view_team_rollup` — see both tabs, seven populated rollup panels.
- Manual: every clickable row navigates correctly.
- **Performance check:** measure page load time on current seeded dataset. Target sub-1-second initial load with all panels populated.

If any gate fails, **stop and report**.

---

## Tech constraints

- Same as prior prompts. No new dependencies.
- No client-side caching layer. Live queries on every panel load.
- No charts in v1 — pivot tables and lists only. The histogram for doc-age distribution renders as horizontal bars made of CSS divs, no chart library.

---

## Hard NOs

- **Do NOT build vanity panels.** Every panel maps to a decision per the PRD.
- **Do NOT introduce leaderboards** of any kind. Throughput is shown for capacity, not ranking. Panel headers reinforce the framing.
- **Do NOT add auto-refresh or live data.** Manual Refresh button only.
- **Do NOT add CSV/PDF export.** Phase 2.
- **Do NOT add chart libraries.** Tables and CSS bars only.
- **Do NOT add cross-program views.** PBV only.
- **Do NOT add panel customization, saved views, or panel reordering.**
- **Do NOT modify the assignment/Lead APIs or the events feed.** Only read.
- **Do NOT modify the pipeline page (`/admin/pbv/pipeline`).** It coexists with this; it's per-application, this is per-person/per-team.
- **Do NOT add notifications.**
- **Do NOT silently break the standalone `/admin/pbv/my-work` URL.** It must redirect.
- **Do NOT add TODOs or placeholders.**

---

## Build report requirements

Create `docs/build-reports/workforce-dashboards_build-report_2026-05-13.md` with:

1. PRD reference + execution mode confirmation
2. Acceptance criteria checklist
3. Files created — list
4. Files modified — list
5. Files deleted — list (should be empty other than possibly the standalone my-work page)
6. Migration verification (`\d` for any column added)
7. Aging thresholds documented
8. API route inventory — each endpoint, auth requirement, sample response shape
9. Test output — Vitest full output
10. Manual walkthrough log — both tabs walked, screenshots in `docs/build-reports/screenshots/workforce-dashboards-2026-05-13/`
11. Performance measurement — page load time per tab on the test dataset
12. Permission gating verification — non-permissioned user cannot see Team Rollup tab AND gets 403 on its endpoints
13. HACH wall verification — devtools-network observation that no rollup data leaks
14. Decision-alignment audit — for each panel, the decision-it-supports copy AND a one-line note from you on whether the implementation answers that decision well
15. Deviations from PRD — with reasoning (empty if none)
16. Pre-existing issues observed
17. Final pass/fail summary

---

## When you finish

Reply in chat with:
- Confirmation single phase completed
- Pass/fail on each verification gate
- Build report path
- Page-load measurement
- Anything that blocked you
- Specifically: did every panel render correctly on a seeded dataset with at least one application in every stage?
- Specifically: did the permission gate work both at the tab level AND at the endpoint level?
- Specifically: did the redirect from `/admin/pbv/my-work` preserve deep links?

If any verification item fails, do not declare complete.
