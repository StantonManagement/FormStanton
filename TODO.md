# Tenant Issues Module — Implementation TODO

## Current Phase
Phase 0: Dashboard Cleanup

## In Progress
- [ ] Collapse StatsBar to single KPI row (remove 3-tier stats, remove emojis)
- [ ] Remove QuickReportForm from dashboard (keep /report route)
- [ ] Make IssuesTable full width on dashboard
- [ ] Inline export + filter controls in one row above table
- [ ] Wire KPI chip clicks to table filters
- [ ] Design system compliance pass (colors, rounding, typography)

## Upcoming
### Phase 1: Unified Activity Timeline
- [ ] Create ti_issue_activities table in Supabase
- [ ] Add createActivity, getActivities, getRecentActivities to api.js
- [ ] Create IssueActivityTimeline component
- [ ] Wire auto-logging into updateIssue, createIssue
- [ ] Replace Notes section in IssueDetails with timeline
- [ ] Backfill existing notes/resolutions/photos into activities table
- [ ] Test end-to-end

## Upcoming Phases
- Phase 2: Post-Creation Action Prompt + Draft Auto-Save
- Phase 3: Tabbed Issue Detail View
- Phase 4: Forward/Handoff Workflow (PDF + approval + copy-to-Outlook)
- Phase 5: Issue-Type Workflow Guidance
- Phase 6: Enhanced Status System (11 statuses)
- Phase 7: Assignment Notifications
- Phase 8: Pattern-Aware Issue Creation
- Phase 9: Resolution Quality & Close-Out

## Done

## Bugs

## Lessons Learned
- npm commands hang in Windsurf Cascade — use `npm install 2>&1 | tail -5` or run manually
- Kimi K2 truncates on complex prompts — keep each request to one file/one task
- SQL should be run in Supabase dashboard, not via terminal
