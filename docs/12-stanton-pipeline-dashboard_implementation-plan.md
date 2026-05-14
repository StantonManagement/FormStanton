# Stanton Pipeline Dashboard — Implementation Plan

**Based on:** `12-stanton-pipeline-dashboard_prompt_2026-04-24.md`  
**Current State:** Phases 1-2 largely complete, need Phases 3-4

---

## Current State Summary

### Already Built (Verified)

| Component | Status | Location |
|-----------|--------|----------|
| Database columns (stage, assigned_to, etc.) | ✅ | Migration `20260424171000_pbv_pipeline_stage_columns.sql` |
| application_events table | ✅ | Migration `20260513200000_application_events_generalize.sql` |
| Pipeline page (table, filters, bulk assign) | ✅ | `app/admin/pbv/pipeline/page.tsx` |
| Pipeline API (computed fields) | ✅ | `app/api/admin/pbv/pipeline/route.ts` |
| Assignment APIs | ✅ | `app/api/admin/pbv/applications/bulk-assign/route.ts`, `[id]/assign/route.ts` |
| Event logging helper | ✅ | `lib/events/application-events.ts` (`writePbvApplicationEvent`) |

### Missing for Complete Implementation

| Component | Needed For | Notes |
|-----------|------------|-------|
| `hach_correspondence_log` table | Phase 4 | No migration exists |
| Detail page at `/admin/pbv/pipeline/[id]/` | Phase 3-4 | Does not exist |
| Activity timeline component | Phase 3 | Read from `application_events` |
| HACH correspondence UI | Phase 4 | Log email/call dialogs, thread view |
| Assignment event logging | Phase 3 | Call `writePbvApplicationEvent` from assign APIs |
| API for fetching events | Phase 3 | `/api/admin/pbv/applications/[id]/events` |
| API for HACH correspondence | Phase 4 | CRUD endpoints |

---

## Implementation Steps

### Step 1: Database Migration — `hach_correspondence_log`

Create migration file:
```sql
-- hach_correspondence_log table
CREATE TABLE IF NOT EXISTS hach_correspondence_log (
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
  logged_at timestamptz default now(),
  created_at timestamptz default now()
);

CREATE INDEX hcl_app_idx ON hach_correspondence_log(application_id, occurred_at desc);
CREATE INDEX hcl_status_idx ON hach_correspondence_log(status, occurred_at desc) WHERE status != 'resolved';

-- RLS
ALTER TABLE hach_correspondence_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access on hach_correspondence_log"
  ON hach_correspondence_log FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
```

### Step 2: Wire Assignment APIs to Application Events

Modify `app/api/admin/pbv/applications/[id]/assign/route.ts`:
- After successful update, call `writePbvApplicationEvent` with `APP_ASSIGNED` event type
- Include previous/new assignee in payload

Modify `app/api/admin/pbv/applications/bulk-assign/route.ts`:
- After successful bulk update, write event per application
- Batch insert into application_events

### Step 3: Detail Page — Activity Timeline

Create `app/admin/pbv/pipeline/[id]/page.tsx`:
- Reuse existing detail layout pattern from `full-applications/[id]/page.tsx`
- Add "Activity Timeline" section that fetches from `/api/admin/pbv/applications/[id]/events`
- Show chronological events with filter by type
- Event types: doc_uploaded, doc_reviewed, status_change, assigned, correspondence

Create API `app/api/admin/pbv/applications/[id]/events/route.ts`:
- Query `application_events` where `anchor_type='pbv_full_application'` and `anchor_id=id`
- Order by `created_at desc`
- Return with pagination (50 per page)

### Step 4: Detail Page — HACH Correspondence Log

Add to detail page:
- "HACH Correspondence" section
- Threaded list sorted by `occurred_at desc`
- Each entry: direction arrow, channel icon, date, subject, body preview
- Status pill (awaiting_their_response, awaiting_our_response, resolved)

Create dialogs:
- "Log HACH email" — direction (inbound/outbound), subject, body, occurred-at date, status
- "Log HACH call" — direction, notes field, occurred-at, status

Create APIs:
- `GET /api/admin/pbv/applications/[id]/correspondence` — list entries
- `POST /api/admin/pbv/applications/[id]/correspondence` — create entry
- `PATCH /api/admin/pbv/correspondence/[id]` — update status

### Step 5: Pipeline Row Enhancement

Modify `/api/admin/pbv/pipeline/route.ts`:
- Join with `hach_correspondence_log` to compute "Last heard from HACH: N days ago"
- Show on pipeline row when `blocked_on = 'hach'`

### Step 6: Backfill Missing Stages

Run SQL to backfill remaining 2 applications without stage:
```sql
UPDATE pbv_full_applications 
SET stage = CASE 
  WHEN stanton_review_status = 'approved' THEN 'approved'
  WHEN stanton_review_status = 'denied' THEN 'denied'
  WHEN intake_submitted_at IS NULL THEN 'intake'
  WHEN hach_review_status IS NOT NULL THEN 'hach_review'
  ELSE 'stanton_review'
END,
stage_changed_at = COALESCE(last_activity_at, created_at),
last_activity_at = COALESCE(last_activity_at, created_at)
WHERE stage IS NULL;
```

---

## File Changes Required

### New Files
1. `supabase/migrations/20260514XXXXXX_hach_correspondence_log.sql`
2. `app/admin/pbv/pipeline/[id]/page.tsx` (detail page)
3. `app/api/admin/pbv/applications/[id]/events/route.ts`
4. `app/api/admin/pbv/applications/[id]/correspondence/route.ts`
5. `components/pipeline/ActivityTimeline.tsx`
6. `components/pipeline/HachCorrespondenceLog.tsx`
7. `components/pipeline/LogHachEmailDialog.tsx`
8. `components/pipeline/LogHachCallDialog.tsx`

### Modified Files
1. `app/api/admin/pbv/applications/[id]/assign/route.ts` — add event logging
2. `app/api/admin/pbv/applications/bulk-assign/route.ts` — add event logging
3. `app/api/admin/pbv/pipeline/route.ts` — add HACH correspondence summary
4. `lib/events/application-events.ts` — add `APP_ASSIGNED` event type

---

## Acceptance Criteria Verification

| Criteria | Implementation Approach |
|----------|------------------------|
| Migration runs; existing applications have correct stage backfilled | Step 6 SQL + already applied migration |
| Pipeline page renders all applications with computed columns | Already implemented |
| Filter by "blocked on tenant" shows only applications with missing docs | Already implemented |
| Filter by "assigned to Tess" shows only Tess's applications | Already implemented |
| Stale row >14 days gets amber highlight | Already implemented |
| Assignment dropdown changes persist and trigger event | Step 2 |
| Unassigned applications appear with red "Unassigned" indicator | Already implemented |
| Bulk reassign works | Already implemented |
| Detail page timeline renders events | Step 3 |
| "Log HACH email" dialog works | Step 4 |
| Pipeline row shows "Last heard from HACH" | Step 5 |
| HACH user gets 403'd | `requireStantonStaff` middleware already in place |

---

## Estimated Effort

- Step 1 (Migration): 15 min
- Step 2 (Assignment events): 30 min
- Step 3 (Timeline): 2 hours
- Step 4 (Correspondence): 3 hours
- Step 5 (Pipeline enhancement): 30 min
- Step 6 (Backfill): 10 min

**Total: ~6-7 hours**

---

## Open Questions for Alex

1. **Stage mapping for backfill** — Is the logic in Step 6 correct for mapping existing `stanton_review_status` to `stage`?
2. **HACH stale threshold** — PRD says 10 days, confirm this is correct?
3. **Dean (field staff) access** — Should he have write access to correspondence log or read-only?
4. **Detail page URL** — Should it be `/admin/pbv/pipeline/[id]/` (new) or keep using `/admin/pbv/full-applications/[id]/`?
