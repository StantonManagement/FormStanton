# Walk Session Notes — Apr 24, 2026

> Cascade autonomous build session. Alex is away; notes are for handoff.

---

## Build 1 — `hach-auth` (Phases 1 & 2)

**Status:** Complete. Committed.

### What was built

- **Migration `20260424160000_hach_auth_schema.sql`**
  - `admin_users.user_type TEXT NOT NULL DEFAULT 'stanton_staff'` with CHECK constraint `('stanton_staff','hach_admin','hach_reviewer')`
  - `admin_users.deactivated_at TIMESTAMPTZ` (soft-delete timestamp)
  - `admin_users.last_login_at TIMESTAMPTZ` (already referenced in auth route; now exists in schema)
  - All existing rows backfilled to `user_type = 'stanton_staff'`
  - `hach_user_invitations` table (one-time tokens for onboarding HACH users)
  - `audit_log.user_type TEXT` and `audit_log.user_agent TEXT` columns added

- **Migration `20260424161000_hach_permissions_seed.sql`**
  - 3 new permissions: `hach.review/read`, `hach.review/write`, `hach.users/admin`
  - 2 new system roles: `hach_admin`, `hach_reviewer`
  - Role→permission assignments via `role_permissions`

- **`lib/auth.ts`**
  - `SessionData.user_type?: string`
  - `SessionUser.user_type: string` (required field)
  - `loadUserPermissions()` now fetches and returns `user_type`
  - `loadSessionUserFromDb()` selects `user_type` from DB
  - `getSessionUser()` / `getRealSessionUser()` both include `user_type`
  - `requireHachUser()` — returns 403 if caller is not `hach_admin` or `hach_reviewer`
  - `requireStantonStaff()` — returns 403 if caller IS a HACH user type

- **`app/api/admin/auth/route.ts`**
  - POST (login): selects `user_type` from DB, stores in session
  - GET: returns `user_type` in response payload
  - DELETE: includes `user_type` in SessionUser for audit log

- **`middleware.ts`** — fully rewritten with HACH guards
  - HACH users hitting `/admin/*` → redirected to `/hach`
  - HACH users hitting `/api/admin/*` (except `/api/admin/auth`) → 403
  - Non-HACH users hitting `/hach/*` (except `/hach/login`) → redirect to `/admin`
  - Non-HACH users hitting `/api/hach/*` → 403
  - Matcher updated: now covers `/hach/:path*` and `/api/hach/:path*`

- **`app/hach/layout.tsx`** — HACH-branded client layout
  - IBM Plex Sans loaded dynamically
  - Deep teal (#0f4c5c) header with sign-out button
  - Auth check: redirects to `/hach/login` if unauthenticated, to `/admin` if Stanton staff

- **`app/hach/login/page.tsx`** — HACH-branded login
  - POSTs to `/api/admin/auth` (shared endpoint)
  - After success, calls GET `/api/admin/auth` to verify `user_type`
  - If `stanton_staff`: logs out and shows "wrong portal" error
  - Inline styles, IBM Plex Sans

- **`app/hach/page.tsx`** — placeholder (replaced in Build 3)

### Assumptions to verify

- `audit_log` already existed in the DB (lib/audit.ts was already using it). Migration adds `user_type` and `user_agent` columns only. **Verify columns apply without conflicts.**
- The `permissions` table has a CHECK constraint on `action IN ('read','write','delete','admin')`. The PRD's `hach.users.manage` was mapped to `hach.users / admin` action to satisfy this constraint. **Verify this is acceptable.**
- Session inactivity timeout (30 min per PRD) is NOT implemented — iron-session uses `maxAge: 24h`. **Defer to Phase 3 or as a separate task.**

### Open questions logged

- Does the existing `admin_users` table have any other auth constraints that would conflict with `user_type`?
- Phase 3 (HACH user management UI at `/hach/admin/users`) and Phase 4 (audit log UI) are NOT built. They're the next pass.
- Invitation acceptance page at `/hach/accept-invite` not built — Phase 3.

---

## Build 2 — `income-eligibility-engine` (Phases 1–4)

**Status:** Complete. Committed.

### What was built

- **Migration `20260424162000_income_eligibility_schema.sql`**
  - `hud_ami_limits` table with Hartford MSA (25540) seed data at 30/50/80% AMI bands, household sizes 1–8
  - `pbv_income_sources` table referencing `pbv_full_applications` and `pbv_household_members`

- **`lib/pbv/income-eligibility.ts`**
  - `EligibilityPayload` type (exported)
  - `FREQUENCY_MULTIPLIERS` — annualization constants per PRD spec
  - `annualize(amount, frequency, paystubCount?)` — pure function, handles paystub-averaging
  - `computeHouseholdIncome(applicationId, asOfDate?, supabaseClient?)` — main engine
  - Looks up AMI limit by MSA + household size + effective date
  - Computes `delta`, `delta_pct`, `within_tolerance` per HUD EIV rule

- **`lib/pbv/income-sources.ts`**
  - `syncIncomeSourcesFromIntake(applicationId)` — parses intake JSONB, upserts `pbv_income_sources` rows (idempotent: delete+reinsert)

- **`app/api/pbv/applications/[id]/income-eligibility/route.ts`**
  - GET only
  - Auth: Stanton staff OR HACH user with `hach.review/read` permission

- **`lib/pbv/__tests__/income-eligibility.test.ts`** — Vitest unit tests
  - weekly × 52, bi-weekly × 26, semi-monthly × 24, monthly × 12
  - Paystub averaging (4 weekly, 2 bi-weekly)
  - Zero income
  - Multi-member household aggregation
  - within_tolerance true/false scenarios

- Added Vitest to devDependencies; added `test` script to package.json

### Assumptions

- HUD AMI figures for Hartford MSA 25540 are **PLACEHOLDER** — clearly marked with TODO comments. **Confirm with Dan before using these in production.**
- `pbv_household_members` is the correct table name (not `pbv_application_members` as written in the PRD).
- Phase 5 (AMI limits admin UI at `/admin/settings/ami-limits`) was skipped per task instructions ("Skip Phase 5 entirely").

### Files created

- `supabase/migrations/20260424162000_income_eligibility_schema.sql`
- `lib/pbv/income-eligibility.ts`
- `lib/pbv/income-sources.ts`
- `app/api/pbv/applications/[id]/income-eligibility/route.ts`
- `lib/pbv/__tests__/income-eligibility.test.ts`

---

## Build 3 — `hach-reviewer-portal` (Phase 1 — read-only)

**Status:** Complete. Committed.

### What was built

- **Migration `20260424163000_hach_reviewer_portal_schema.sql`**
  - `document_review_actions` table
  - `application_view_events` table
  - `pbv_full_applications.hach_review_status` column (separate from `stanton_review_status`)

- **API routes under `/api/hach/`**
  - `GET /api/hach/applications` — queue data grouped by state
  - `GET /api/hach/applications/[id]` — full packet data (household, income, docs, review history)

- **`/hach/page.tsx`** — queue with three groups (Needs First Review / Awaiting Response / Approved This Week)

- **`/hach/applications/[id]/page.tsx`** — packet view (header, progress bar, income panel, household table, documents grouped by category)

- **Components** (all inline-styled, IBM Plex Sans, deep teal)
  - `components/hach/QueueItem.tsx`
  - `components/hach/PacketHeader.tsx`
  - `components/hach/IncomePanel.tsx`
  - `components/hach/HouseholdTable.tsx`
  - `components/hach/DocumentGroup.tsx`
  - `components/hach/DocumentRow.tsx`

- **Seed script** `scripts/seed-hach-test-data.ts` — creates 3 test applications:
  1. "Needs First Review" — all docs pending, no actions
  2. "Awaiting Response" — mixed docs (approved/rejected/pending resubmission)
  3. "Approved This Week" — all docs approved, `hach_review_status = approved_by_hach`

### Hard stops (Phase 2+ not built)
- Approve action NOT wired up
- Reject dialog NOT built
- Document viewer modal NOT built
- All action buttons render as disabled or absent

### Assumptions

- `pbv_full_applications` does not have a separate HACH-facing status column. Added `hach_review_status` rather than extending `stanton_review_status` to keep the two review workflows independent.
- The income panel calls `/api/pbv/applications/[id]/income-eligibility` — returns 404/empty if no income sources have been synced yet (correct behavior, shown as "No income data available").
- Queue grouping uses presence/absence of `document_review_actions` rows to determine "Needs First Review" vs "Awaiting Response".

---

---

## Session 2 — hach-reviewer-portal phases 2, 3, 5

### Commits
- `hach-reviewer-portal: approve action with optimistic UI (phase 2)` (fe73079)
- `hach-reviewer-portal: document viewer modal with version nav (phase 3)` (0ba0951)
- `hach-reviewer-portal: keyboard shortcuts + ShortcutsBar + help modal (phase 5)` (a67f4ea)

### Files changed
- `app/api/hach/documents/[id]/approve/route.ts` — new POST endpoint. Guards with `requireHachUser()`. Scope-checks document belongs to a HACH-accessible application via `pbv_full_applications.hach_review_status NOT NULL`. Inserts `document_review_actions` row, calls `logAudit()`. Returns effective_status + progress summary.
- `app/api/hach/documents/[id]/signed-url/route.ts` — new GET endpoint. Guards with `requireHachUser()`. Scope-checks same as above. Fetches `form_submission_document_revisions` for version history. Batch-signs all paths via Supabase Storage `form-submissions` bucket (TTL 300s). Returns signed URL list + current version.
- `components/hach/DocumentViewer.tsx` — new client component. Props: `{ document, onClose }`. Fetches signed URL on mount, renders PDFs in iframe, images in `<img>`, unknown types via download link. Version tabs when >1 revision. Keyboard: Esc closes, ArrowLeft/Right navigate versions. Click-outside closes.
- `app/hach/applications/[id]/page.tsx` — full rewrite (Build 2 was encoding-fixed Build 1). Added: Approve button with optimistic UI + revert on error + toast. View button wired to DocumentViewer. Keyboard handler (J/K/A/V/R/?/Esc). ShortcutsBar fixed at bottom. ShortcutsHelpModal on `?`. Flash-row state for R key.

### Assumptions
- Storage bucket name is `form-submissions` — confirmed from `app/api/admin/submissions/[submissionId]/documents/route.ts`.
- `form_submission_document_revisions` table exists (from prior migration 20260423180000) and is used to populate the version navigator in the document viewer.
- `last_activity_at` column on `pbv_full_applications` does NOT exist — the approve route attempts the update in a try/catch and silently skips on error.
- The sync `{ params }: { params: { id: string } }` pattern is used to match the existing codebase convention (same as `app/api/hach/applications/[id]/route.ts`). The `.next/dev/types/validator.ts` type errors for this are pre-existing and not new.
- Phase 4 (reject dialog) was explicitly skipped. The `R` keyboard key flashes the row with "Reject coming soon" label and does no API call.
- Phases 6–7 were explicitly skipped.

### Open questions
- Should the Approve action also update `pbv_full_applications.hach_review_status` to `under_hach_review` if it was `pending_hach`? Currently it does not.
- When ALL documents are approved, should `hach_review_status` auto-advance to `approved_by_hach`? Deferred to Phase 4+ decision.
- The `canView` condition on DocumentRow checks `doc.storage_path || doc.file_name`. For documents where only `storage_path` is stored (not returned to client from the GET route for security), the View button may be hidden. The GET route at `app/api/hach/applications/[id]/route.ts` should be verified to confirm it returns `storage_path` or at least `file_name`.

---

## Existing code observations (things to flag)

- `app/api/admin/auth/route.ts` selects `role` column from `admin_users` — this column appears to be a legacy field from before the RBAC system. No migration drops it, so it still exists. Low risk but worth cleaning up eventually.
- `lib/audit.ts` uses `username` column on `audit_log`, but the PRD schema calls it without `username`. The existing column was preserved; new `user_type` added alongside. The audit log now has both old-style and new-style columns — a minor inconsistency to address in a future cleanup migration.
- No Vitest was configured in the project before Build 2. Added it as a devDependency with minimal config in `vitest.config.ts`.

---

## Session 2 — Builds 0–3

### Build 0: Pre-flight fix — file_name in packet API (commit: `hach-reviewer-portal: include file_name in packet API response`)

- `app/api/hach/applications/[id]/route.ts`: After building `latestActionByDoc`, now fetches all revisions from `form_submission_document_revisions` ordered by `revision DESC`, builds `latestRevFileName` map (first-seen wins per `document_id`), and overrides `file_name` in `enrichedDocs` with `latestRevFileName[doc.id] ?? doc.file_name`. This unblocks the `canView` check in the UI.
- Closed open question from Session 1 re: `file_name` in document viewer.

### Build 1: New since last visit badges (commit: `hach-reviewer-portal: new-since-last-visit badges (phase 6)`)

- **`lib/hach/view-tracking.ts`**: `recordApplicationView(applicationId, reviewerId, reviewerName)` — inserts into `application_view_events` using columns `full_application_id`, `reviewer_id`, `reviewer_name`, `viewed_at`. Fire-and-forget.
- **`app/api/hach/applications/[id]/view/route.ts`**: `POST` endpoint, requires HACH auth. Called from packet page on mount.
- **`app/api/hach/applications/[id]/route.ts`**: Added `getSessionUser()` call; after enrichedDocs, queries `application_view_events` for `max(viewed_at)` for current reviewer, then counts revisions in `form_submission_document_revisions` created after that timestamp. Returns `last_viewed_at` and `new_since_last_view` in the response body.
- **`app/api/hach/applications/route.ts`**: Added `getSessionUser()`; changed docCounts select to include `id`; builds `docIdToSubmId` and `submIdToAppId` maps; queries view events and all revisions; computes `newRevsByApp` (only counts revisions after `last_viewed_at`, never-viewed → 0); includes `last_viewed_at` and `documents_uploaded_since_last_view` in each queue row.
- **`app/hach/page.tsx`**: `QueueApp` interface extended with `last_viewed_at` and `documents_uploaded_since_last_view`. `AppRow` shows teal `N new` badge inline with applicant name when count > 0.
- **`app/hach/applications/[id]/page.tsx`**: Added `newSinceLastView` + `lastViewedAt` state; `useEffect` fires `POST /api/hach/applications/[id]/view` on mount; `formatRelativeTime(iso)` helper added; blue info banner renders below the header card when `newSinceLastView > 0 && lastViewedAt`.

### Build 2: User management UI + invitation acceptance (commit: `hach-auth: user management UI + invitation acceptance (phase 3)`)

- **`middleware.ts`**: Whitelisted `/hach/accept-invite` and `/api/hach/accept-invite` as public routes (same pattern as `/hach/login`).
- **`app/hach/layout.tsx`**: Added `userType` state (populated from `/api/admin/auth`); `hach_admin` sees "Users" and "Audit Log" nav links in the header with active-state highlight. Added `isAcceptInvitePage` bypass for auth check and header visibility.
- **`app/api/hach/admin/users/route.ts`**: `GET` returns HACH users + pending invitations (with inviter display names). `POST` creates invitation — validates email + user_type, checks for existing account by username, generates `crypto.randomUUID()` token, 7-day expiry, logs invite URL to console, calls `logAudit`.
- **`app/api/hach/admin/users/[id]/deactivate/route.ts`**: `POST` — validates target is HACH user, blocks self-deactivation, sets `deactivated_at` + `is_active = false`, calls `logAudit`.
- **`app/api/hach/accept-invite/route.ts`**: `GET` validates token (checks expiry + accepted_at). `POST` validates full form, creates `admin_users` row with bcrypt-hashed password, marks invitation accepted, creates session (same flow as login), logs `user.account_created` audit event.
- **`app/hach/admin/users/page.tsx`**: Invite modal (email + role select) → on success shows URL-copy dialog with copyable invite link. User table with deactivate action (optimistic UI + revert on failure). Pending invitations table. Admin-only via 403 guard.
- **`app/hach/accept-invite/page.tsx`**: Token validated on mount via `GET /api/hach/accept-invite`. Form collects display_name + password (12-char min, letter+number required). On success, auto-redirects to `/hach`. Wrapped in `<Suspense>` for `useSearchParams()`. Full-page layout (layout header hidden on this page).

### Build 3: Audit log viewer (commit: `hach-auth: audit log viewer for hach admins (phase 4)`)

- **`app/api/hach/admin/audit-log/route.ts`**: `GET` — resolves HACH user IDs from `admin_users` WHERE user_type IN ('hach_admin','hach_reviewer'), filters `audit_log` by those IDs. Supports `date_from`, `date_to`, `user_id`, `action` query params. `dateTo` is inclusive (adds 1 day). Offset-based pagination (50/page). Returns distinct action list + HACH user list for filter dropdowns.
- **`app/hach/admin/audit-log/page.tsx`**: Filter bar with preset buttons (7d/30d/90d/All), date range inputs, user dropdown, action dropdown. AbortController cancels in-flight requests on filter change. Table columns: timestamp, user (with user_type sub-line), action badge (color-coded: amber=auth, purple=write, gray=read), entity type+ID (application entity_ids are linked to `/hach/applications/[id]`), expandable JSON details, IP address. Offset pagination with Prev/Next. Admin-only via 403 check.

### Open questions / deferred
- Password reset action in user management table currently shows "coming soon" toast — no reset-by-admin flow implemented.
- `logAudit()` helper does not set the `user_type` column on `audit_log` rows. Existing HACH audit entries will have `user_type = null` unless `logAudit` is extended. The audit log viewer filters by `user_id IN (hach_user_ids)` rather than by `user_type` to work around this.
- Email delivery for invitations is deferred — invite URL is logged to console only.
