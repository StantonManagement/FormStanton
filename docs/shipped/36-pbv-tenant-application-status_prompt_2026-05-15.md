# Cursor/Windsurf Prompt — PRD-36: Tenant-Facing Application Status

## Context

Today, after a tenant submits their PBV application, the dashboard shows the same task cards forever with no indication of office review status, action required, approval, or denial. This PRD adds a status banner driven by a new `application_review_status` column. No notifications (PRD-05 owns those). Read-only — staff manage status via SQL or future admin UI.

PRD-33 should land first (so the dashboard is functional for navigation). PRD-34's snapshot pattern is a soft dependency; not strictly required.

## Required reading before you start

1. `docs/fullApp-Plan/36-pbv-tenant-application-status_prd_2026-05-15.md` — this PRD
2. `app/api/t/[token]/pbv-full-app/route.ts:240-290` — bootstrap response shape (F2 target)
3. `lib/pbv/hooks/useDashboardState.ts` — DashboardData type and fetch (F2 target)
4. `components/pbv/sign/TenantDashboard.tsx:160-210` — where to mount the banner (F3 target)
5. `components/pbv/sign/DashboardCard.tsx` — existing card component for reference styling
6. `app/globals.css` and `tailwind.config.ts` — CSS variables for paper/ink/primary/error
7. `application_documents` schema and `status = 'rejected'` rows for F4

## Closed decisions

- New column on `pbv_full_applications`, not derived from existing fields
- Status taxonomy: `submitted | under_review | action_required | approved | denied | archived`
- No staff UI in this PRD; staff set status via SQL or future PRD
- Backfill: every existing complete application starts as `submitted`
- Office contact: hardcoded per property in V1

## Decisions resolved (Alex confirmed 2026-05-15)

- **SLA copy (en)**: `"Office reviews typically within 2 weeks of submission."` — translate equivalents for es/pt, mark pt tentative
- **Office contact (V1, all buildings)**: `info@stantoncap.com` / `(860) 993-3401`
- **Action-required count source**: `application_documents.status = 'rejected'`. No other sources in V1.
- **Banner persistence**: dashboard only.
- **Taxonomy**: confirmed as in PRD.

## Build this pass

### Phase 1 — Schema + read path

1. **F1** — Migration `supabase/migrations/<YYYYMMDD>_pbv_application_review_status.sql` adds the three columns and the backfill UPDATE per PRD's Data Model section. Test in PGlite.
   Commit: `feat(pbv-schema): add application_review_status fields with backfill (F1)`

2. **F2** — `app/api/t/[token]/pbv-full-app/route.ts`: add the three new fields to `.select()` and to the response object. Add a derived `rejected_documents_count` to the response (count of `application_documents.status = 'rejected'` for this app). Update `lib/pbv/hooks/useDashboardState.ts` `DashboardData` type and the fetch shape. No client UI yet.
   Smoke: GET bootstrap returns the new fields; backfilled `application_review_status` is `submitted` for completed apps.
   Commit: `feat(pbv-bootstrap): expose application_review_status to client (F2)`

### Phase 2 — UI + content

3. **F3** — Create `components/pbv/sign/ApplicationStatusBanner.tsx`. Props: `status`, `statusAt`, `statusNote`, `rejectedCount`, `language`, `officeContact`. Render a translated banner per status. Color/border per status (green/blue/yellow/green/red/grey). Mount inside `TenantDashboard` above the task cards, only when `intake_status === 'complete'` and `application_review_status` is set.
   Translations: full en/es/pt for all status strings. Mark pt strings with `// PT: tentative — review`.
   Commit: `feat(pbv-dashboard): ApplicationStatusBanner with 6 status variants (F3)`

4. **F4** — `TenantDashboard`: when `application_review_status = 'action_required'`, swap the documents card label to `"Replace rejected documents (N)"` and route to `/pbv-full-app/${token}/documents?filter=rejected` (the documents page from PRD-33 F3 should respect the filter param; if it doesn't yet, add it). Translations.
   Commit: `feat(pbv-dashboard): action-required surfacing on documents card (F4)`

5. **F5** — Create `lib/pbv/officeContacts.ts` exporting a `Record<string, { name: string; phone: string; email: string; hours: string }>` keyed by `building_address`. Populate with real values for known buildings (ask Alex). Surface in the banner for `denied` and `action_required` statuses. If a building isn't in the map, fall back to a generic placeholder with a ticket reference.
   Commit: `feat(pbv-dashboard): office contact info per building (F5)`

### Phase 3 — Polish

6. Visual QA pass: render each of the 6 status variants in a Storybook entry or a manual test page. Confirm color contrast meets WCAG AA. Confirm banner fits on 375px viewport without breaking the dashboard layout.
   Commit: `chore(pbv-dashboard): visual QA fixes for status banner (Phase 3)`

## Verification

- Set `application_review_status = 'submitted'` via SQL on a test app; reload dashboard; banner appears.
- Cycle through each status with a SQL UPDATE; reload; correct banner each time.
- For `action_required`: also flip a document to `status = 'rejected'`; banner shows count, documents card surfaces it.
- Mobile screenshot for at least one status.

## Build report requirements

- SQL UPDATE statements used to test each status
- Screenshots of banner per status (mobile + desktop)
- Office contact info populated (or placeholders documented)
- Translations reviewed flag (pt remains tentative)
