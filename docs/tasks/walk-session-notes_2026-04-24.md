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

## Existing code observations (things to flag)

- `app/api/admin/auth/route.ts` selects `role` column from `admin_users` — this column appears to be a legacy field from before the RBAC system. No migration drops it, so it still exists. Low risk but worth cleaning up eventually.
- `lib/audit.ts` uses `username` column on `audit_log`, but the PRD schema calls it without `username`. The existing column was preserved; new `user_type` added alongside. The audit log now has both old-style and new-style columns — a minor inconsistency to address in a future cleanup migration.
- No Vitest was configured in the project before Build 2. Added it as a devDependency with minimal config in `vitest.config.ts`.
