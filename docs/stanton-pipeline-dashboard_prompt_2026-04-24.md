# Windsurf Prompt — Stanton Pipeline Dashboard

**PRD:** `stanton-pipeline-dashboard_prd_2026-04-24.md` (read it first)

**Required dependencies already built:** `hach-auth` (stanton_staff user type), `income-eligibility-engine` (income status), `hach-reviewer-portal` (document review state)

---

## Context

Stanton staff need a single pipeline view of every PBV conversion application. Today this lives in heads, email, and folder inspection. The existing `/admin/pbv/full-applications` page shows a list but doesn't surface the key operational signals: who's blocked, how stale, what's the next action, where is HACH, who's chasing whom.

This is the Stanton-side mirror of the HACH reviewer portal. Same underlying data, but optimized for pipeline management rather than packet review.

---

## Build this pass

Phases 1, 2, 3, and 4 from the PRD. Phases 5 (tenant chase actions) and 6 (portfolio rollup) are the next pass — Phase 5 requires `rejection-tenant-loop` to be complete first.

### Specific scope

1. **Migration** per PRD schema:
   - Add `stage`, `assigned_to`, `stage_changed_at`, `last_activity_at` to `pbv_full_applications`
   - Backfill `stage` from existing `status` values — map reasonably (e.g., status=`intake_complete` → stage=`stanton_review`, etc.; ask Alex for the exact mapping if ambiguous)
   - Backfill `last_activity_at` from most recent of: created_at, last document upload, last review action
   - Create `hach_correspondence_log` and `application_events` tables

2. **Pipeline page** at `/admin/pbv/pipeline/page.tsx`:
   - Replaces or extends the existing `/admin/pbv/full-applications` (keep it reachable via link for now; don't break existing bookmarks)
   - Table with columns per PRD
   - Sorting: default to `last_activity_at` ascending (most stale first)
   - Filters (URL-synced query params):
     - Building (multi-select)
     - Stage (multi-select)
     - Blocked on (single-select: tenant / stanton / hach / nobody / all)
     - Assigned to (single-select from staff list)
     - Has rejections (boolean)

3. **Computed fields:**
   - `blocked_on` — server-computed from application state:
     - Any docs in `missing` → `tenant`
     - All docs reviewed, app stage = `stanton_review` → `stanton`
     - App stage = `hach_review` AND most recent HACH action > 10 days ago → `hach`
     - Otherwise → `nobody`
   - `days_in_stage` — days since `stage_changed_at`
   - `next_action` — short string driven by `blocked_on`:
     - tenant: "Chase tenant: {count} docs missing"
     - stanton: "Review and submit to HACH"
     - hach: "Poke HACH — last heard {N} days ago"
     - nobody: "—"

4. **Visual indicators:**
   - Stale rows (>14 days): amber left border
   - Very stale rows (>30 days): red left border
   - Blocked-on pill with color coding (blue tenant / orange stanton / purple hach / gray nobody)
   - Income status icon: ✓ / ⚠ / ✗ with tooltip showing the delta

5. **Assignment UI (Phase 2):**
   - Assignment column = inline dropdown
   - Dropdown populated from `admin_users WHERE user_type = 'stanton_staff' AND deactivated_at IS NULL`
   - Saves on change, fires `application_events` row
   - Empty assignment shows "Unassigned" in red
   - Bulk reassign: checkbox column + "Assign selected to..." action bar at top when rows are selected

6. **Activity event stream (Phase 3):**
   - Helper `logApplicationEvent(applicationId, eventType, summary, metadata)` in `lib/pbv/events.ts`
   - Call from: document upload (tenant), document review action (HACH or Stanton), status change, assignment change, correspondence logged, chase sent
   - Timeline component on `/admin/pbv/pipeline/[id]` detail page — chronological, most recent first, event type filter, actor info

7. **HACH correspondence log (Phase 4):**
   - On the application detail page, a "HACH Correspondence" section
   - Threaded list of entries sorted by `occurred_at desc`
   - Each entry: direction arrow, channel icon, date, subject (if email), body/notes, who logged it, status pill
   - "Log HACH email" dialog:
     - Direction = inbound (default) or outbound
     - Channel = email
     - Paste-in subject + body
     - Occurred-at date picker (default = today)
     - Status dropdown
   - "Log HACH call" dialog — similar but channel = phone, no subject, notes field
   - Pipeline table row shows "Last heard from HACH: {N} days ago" computed from most recent inbound entry

---

## Tech constraints

- Next.js App Router, server components for data fetching where possible
- Keep existing `/admin/pbv/full-applications` functional — add a link from there to `/admin/pbv/pipeline`
- Inline styles matching the existing admin aesthetic (IBM Plex Sans, stone neutrals)
- Do NOT use Tailwind
- URL-synced filter state (so staff can share links to filtered views)
- Table should handle 100+ rows without performance issues (virtualize only if needed)

---

## Acceptance criteria

- [ ] Migration runs; existing applications have correct stage backfilled
- [ ] Pipeline page renders all applications with all computed columns correct
- [ ] Filter by "blocked on tenant" shows only applications with missing docs
- [ ] Filter by "assigned to Tess" shows only Tess's applications
- [ ] Stale row >14 days gets amber highlight
- [ ] Assignment dropdown changes persist and trigger an event in `application_events`
- [ ] Unassigned applications appear with red "Unassigned" indicator
- [ ] Bulk reassign: selecting 3 rows and picking a new assignee updates all 3
- [ ] Detail page timeline renders events from `application_events` in reverse chronological order
- [ ] "Log HACH email" dialog works — paste-in, save, appears in correspondence thread
- [ ] Pipeline row shows correct "Last heard from HACH: N days ago" after an inbound entry is logged
- [ ] Existing Stanton admin users can access `/admin/pbv/pipeline` with their existing session
- [ ] A HACH user hitting `/admin/pbv/pipeline` gets redirected/403'd per `hach-auth` middleware

---

## Do NOT in this pass

- Build tenant chase actions (Phase 5 — needs `rejection-tenant-loop` live)
- Build portfolio rollup / summary cards (Phase 6)
- Build forward-to-alias for auto-logging HACH emails
- Automate stage transitions based on events — stages change explicitly for now
- Touch the HACH reviewer portal
- Add CSV export
