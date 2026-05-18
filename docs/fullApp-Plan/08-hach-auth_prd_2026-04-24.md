# HACH Auth & Portal Isolation — PRD

**Status:** Draft — ready for build
**Depends on:** None (foundational)
**Blocks:** hach-reviewer-portal, stanton-pipeline-dashboard, rejection-tenant-loop, appointment-scheduling

---

## Problem Statement

HACH reviewers need login access to a dedicated PBV review portal. Critically, they must be **strictly isolated** from Stanton's internal admin system — they can see only the HACH reviewer surface and nothing else in the Stanton stack (no FormsStanton admin, no compliance matrix, no MOC dashboard, no other projects, no tenant data outside PBV applications).

HACH must also be able to self-administer their users — Alex should not be in the loop every time HACH wants to add or remove a reviewer. One or two designated HACH admins create and manage reviewer accounts themselves.

Secondary requirement: because this is a federal program, every action taken by a HACH user must be auditable — who approved what, when.

---

## Users & Roles

| Role | Capabilities |
|---|---|
| Stanton Super Admin (Alex) | Creates the initial HACH Admin account; everything else |
| HACH Admin | Creates/deactivates HACH reviewer accounts; can also review packets |
| HACH Reviewer | Reviews packets; cannot manage other users |
| Stanton Staff (existing) | Continues to see Stanton admin system; cannot see HACH-only routes |

---

## Core Features

### 1. User type discrimination
- Extend `admin_users` with `user_type text not null default 'stanton_staff'`
- Valid values: `stanton_staff`, `hach_admin`, `hach_reviewer`
- Backfill all existing rows to `stanton_staff`

### 2. Route isolation
- All routes under `/admin/*` deny requests from users where `user_type IN ('hach_admin', 'hach_reviewer')` — return 403
- All routes under `/hach/*` deny requests from `stanton_staff` — return 403
- Middleware-level enforcement, not per-route

### 3. Data scoping
- Every query executed under a HACH user session is scoped to PBV applications only
- Attempting to access any non-PBV table or record via the HACH portal returns 403
- Implemented server-side in API route guards — the frontend never receives data it shouldn't see

### 4. RBAC extension
- New permissions: `hach.review.read`, `hach.review.write`, `hach.users.manage`
- `hach_admin` gets all three; `hach_reviewer` gets the first two
- Continue to use existing `role_permissions` / `user_roles` infrastructure — don't fork

### 5. HACH admin user management UI
- Located at `/hach/admin/users`
- List all HACH users (admin + reviewer), with status (active/deactivated), last login, created date
- Invite by email: generates magic-link invitation, sends via Resend
- Deactivate user (soft delete — preserves audit trail)
- Reset another user's password (admin-initiated reset flow)

### 6. HACH user invitation flow
- HACH admin enters email + selects role (admin or reviewer)
- System creates `hach_user_invitations` row with a one-time token, 7-day expiry
- Resend sends email with link: `/hach/accept-invite?token=[token]`
- Recipient sets password, name → account created with `user_type` matching invitation
- Token consumed on acceptance

### 7. Audit log
- Every HACH user action logged: login, packet viewed, document approved/rejected, voucher issued, user invited/deactivated
- Immutable table — no updates, no deletes
- Viewable by HACH admin and Stanton super admin
- Retention: indefinite (federal program compliance requirement)

### 8. Password & session policy
- Password minimum 12 chars, must include letter + number
- Session timeout: 30 min of inactivity
- Reuse existing iron-session; no new session mechanism

---

## Data Model

```sql
-- Extension to existing admin_users
ALTER TABLE admin_users
  ADD COLUMN user_type text not null default 'stanton_staff',
  ADD CONSTRAINT admin_users_user_type_check
    CHECK (user_type IN ('stanton_staff', 'hach_admin', 'hach_reviewer'));

ALTER TABLE admin_users
  ADD COLUMN deactivated_at timestamptz,
  ADD COLUMN last_login_at timestamptz;

-- Invitation flow
CREATE TABLE hach_user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_type text not null CHECK (user_type IN ('hach_admin', 'hach_reviewer')),
  invited_by uuid references admin_users(id),
  token text unique not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

-- Audit trail
CREATE TABLE audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references admin_users(id),
  user_type text not null,
  action text not null,           -- e.g. 'document.approved', 'user.invited'
  resource_type text,             -- e.g. 'document', 'application'
  resource_id text,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now() not null
);

CREATE INDEX audit_log_user_idx ON audit_log(user_id, created_at desc);
CREATE INDEX audit_log_resource_idx ON audit_log(resource_type, resource_id);
```

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| Existing `admin_users` table | Extend | Add user_type column + audit columns |
| Existing `lib/auth.ts` (iron-session) | Extend | Session now carries user_type; `requirePermission()` and route guards check it |
| Existing RBAC (`role_permissions`) | Extend | Add three new permissions |
| Resend | Write | Invitation emails |

---

## Implementation Phases

### Phase 1 — Schema & backfill
- Migration: add `user_type`, `deactivated_at`, `last_login_at` to `admin_users`
- Create `hach_user_invitations` and `audit_log` tables
- Backfill existing rows

### Phase 2 — Route guards
- Extend middleware: if `user_type IN ('hach_admin','hach_reviewer')` and path starts with `/admin` → 403
- Inverse for `/hach` routes
- Update `getSession()` to include `user_type`
- Update `requirePermission()` to check user_type implicitly

### Phase 3 — HACH user management UI
- `/hach/admin/users` list page
- Invite modal (email + role dropdown)
- Deactivate action
- Acceptance page at `/hach/accept-invite`

### Phase 4 — Audit logging
- `logAudit()` helper in `lib/audit.ts`
- Call from every HACH-side mutation endpoint
- `/hach/admin/audit-log` view for HACH admins
- `/admin/pbv/audit-log` view for Stanton super admins

---

## Out of Scope

- SSO / SAML (not needed — HACH has no identity provider we could federate with)
- 2FA (defer to v2 unless Dan requires it for the program)
- Self-service password reset (admin-initiated only in v1)
- Role editing post-invitation (if HACH wants to promote a reviewer to admin, deactivate + reinvite)

---

## Open Questions

| Question | Owner |
|---|---|
| Does HACH have a compliance officer who needs audit log access separate from their admin? | Alex / HACH |
| Password policy — does HACH have organizational requirements stricter than ours? | Alex |
| Do we need IP allowlisting for HACH users (i.e., only from their office network)? | Dan |
