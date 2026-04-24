# Windsurf Prompt — HACH Auth & Portal Isolation

**PRD:** `hach-auth_prd_2026-04-24.md` (read it first, treat as source of truth)

---

## Context

FormsStanton is a Next.js (App Router) + Supabase + Vercel app at `form-stanton.vercel.app`. Auth is iron-session-based with RBAC (`admin_users`, `user_roles`, `role_permissions`, `permissions`) defined in `lib/auth.ts`. All current users are Stanton internal staff.

We're adding a second class of user — Hartford Housing Authority (HACH) reviewers — who need access to a dedicated PBV review portal and **nothing else**. They must be architecturally prevented from accessing any `/admin/*` route, and HACH admins must be able to self-administer their own users.

---

## Build this pass

Phases 1 and 2 from the PRD — schema + route guards. User management UI (Phase 3) and audit logging (Phase 4) are the next pass.

### Specific scope for this pass

1. **Migration** adding `user_type`, `deactivated_at`, `last_login_at` to `admin_users`, plus `hach_user_invitations` and `audit_log` tables. Backfill all existing `admin_users` rows to `user_type = 'stanton_staff'`.

2. **Session enhancement:** `getSession()` in `lib/auth.ts` now returns `user_type`. Populate from DB on login.

3. **Route guards:**
   - In `middleware.ts`: if request path starts with `/admin` AND session user_type is in `('hach_admin','hach_reviewer')` → redirect to `/hach` with 403 flash
   - Inverse: path starts with `/hach` AND user_type = `'stanton_staff'` → redirect to `/admin`
   - Unauthenticated requests → existing login redirect behavior

4. **API route scoping helper:** `requireHachUser()` and `requireStantonStaff()` in `lib/auth.ts` that throw 403 if the session user_type doesn't match. Use these at the top of every route handler in `/api/hach/*` and `/api/admin/*` respectively.

5. **Scaffold `/hach` route tree:**
   - `/hach/page.tsx` — placeholder "HACH Reviewer Portal — coming soon" (actual queue is PRD 3)
   - `/hach/layout.tsx` — new layout distinct from admin layout; no navigation to `/admin/*`
   - `/hach/login/page.tsx` — HACH-branded login (can share auth logic with admin login)

6. **Permission seeds:** insert rows into `permissions` for `hach.review.read`, `hach.review.write`, `hach.users.manage`. Create `hach_admin` and `hach_reviewer` roles and link permissions.

---

## Tech constraints

- Next.js App Router only (no Pages Router)
- Supabase JS client on server (service role for admin ops, anon key with RLS for user ops)
- Do not introduce any new auth library — extend iron-session
- Styling: match existing admin aesthetic (inline styles, IBM Plex Sans) — see `app/admin/pbv/full-applications/page.tsx` for reference
- TypeScript throughout

---

## Acceptance criteria

- [ ] Existing Stanton staff can still access `/admin/*` exactly as before
- [ ] A user manually set to `user_type = 'hach_reviewer'` in the DB, logging in, hitting `/admin/anything` gets redirected to `/hach`
- [ ] Same user hitting any `/api/admin/*` endpoint gets a 403
- [ ] Attempting to SELECT from a non-PBV table via a HACH-session API route returns 403 (scaffold a test route that tries this and is blocked)
- [ ] `/hach` renders the placeholder layout for HACH users
- [ ] Migration runs cleanly on a fresh DB and is idempotent

---

## Do NOT in this pass

- Build the HACH user management UI (`/hach/admin/users`) — that's Phase 3, next pass
- Build the audit log table UI — Phase 4, next pass
- Build the invitation acceptance flow — Phase 3, next pass
- Touch any existing Stanton admin functionality beyond adding the middleware guard
- Build the actual reviewer portal (queue, packet view) — that's `hach-reviewer-portal`
