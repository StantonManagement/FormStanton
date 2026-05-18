# PRD-29 — PBV Form Execution: Staff-Assisted Mode Polish

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md` §8, `docs/fullApp-Plan/25-pbv-form-execution-phase1-intake-ui_prd_2026-05-15.md`, `docs/fullApp-Plan/26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md`
**Depends on:** PRDs 25–27 complete

---

## Problem Statement

About 30% of households can't or won't complete the digital flow alone. Staff (Will at the lobby) supports an assisted mode: staff is logged into their own session, opens the tenant's application, fills the intake answers as the tenant dictates, then hands the device to the tenant for the signature ceremony.

The integrity boundary: **the signature is always the tenant's**. Staff never signs on the tenant's behalf, even in staff-assisted mode.

This PRD adds the staff-assisted mode banner + audit hooks. The intake and signing flows themselves (PRDs 25/26) work unchanged — only the audit trail and a few UX affordances differ.

## Key decisions

### 1. Reuse existing impersonation pattern

The codebase has `components/admin/ImpersonationBanner.tsx` and `/api/admin/impersonate/` routes. Staff-assisted mode is a specialized impersonation: staff opens a tenant's session via the admin shell, the tenant-side UI runs in "assisted" mode showing the banner.

Don't reinvent — extend the impersonation infrastructure to support a `mode = 'pbv_assisted'` distinction.

### 2. Mode flag on the session

When staff initiates assisted mode for a specific PBV application:
- The session carries `assisted_mode: { staff_user_id, application_id, started_at }`
- Tenant UI reads this from the bootstrap response and shows the AssistedBanner
- All API writes from this session include an `X-Assisted-By: {staff_user_id}` header
- `pbv_signature_events.device_owner = 'staff_assisted'` on every signature event during the session

### 3. Banner UX

`AssistedBanner` always visible at top of tenant UI in assisted mode:

```
[Will Esposito] is filling this with you. Pass them the phone to sign.
[End assisted session]
```

When tenant is about to sign: the banner changes to instruction: "Now hand the phone to {tenant name}. They sign for themselves." with a tap-to-acknowledge.

### 4. Signature handoff

At the signing step in PRD-26's flow:
- The SignaturePadGate component checks for `assisted_mode`
- If present: shows a handoff confirmation screen first ("Please hand the phone to Maria so she can sign.")
- Tenant signs as themselves; `device_owner = 'staff_assisted'` recorded
- `assisted_by_staff_user_id` recorded on every signature event for this ceremony

### 5. Server-side audit

`pbv_signature_events` gets one additional column (small migration):

```sql
ALTER TABLE public.pbv_signature_events
  ADD COLUMN assisted_by_staff_user_id UUID REFERENCES public.auth_users(id);
```

(Or whatever the staff-users table is named — `pbv_staff_users` per migration `20260424151305`?)

Populate this from the `X-Assisted-By` header at sign-form time, after validating the header against an active impersonation session.

### 6. Staff-facing UX

Staff initiate assisted mode from the existing admin PBV full-application view:
- `app/admin/pbv/full-applications/[id]/page.tsx` gets a new "Start assisted session" button
- Tapping opens the tenant portal in a new tab in assisted mode
- A timer / banner in admin shows that an assisted session is active
- "End assisted session" available from either admin or tenant side; closes the session

### 7. Out of scope: kiosk mode

The original PRD mentioned a kiosk variant. Skip for now — staff has their own laptop / iPad, no need for a generic kiosk. Revisit later if Will requests it.

## Scope

### What this PRD does

- Add `mode = 'pbv_assisted'` to the impersonation mechanism
- AssistedBanner component on tenant side
- Handoff confirmation in the signing flow
- `pbv_signature_events.assisted_by_staff_user_id` column + migration
- API middleware reading `X-Assisted-By` and writing to signature events
- Admin "Start assisted session" / "End session" controls

### What this PRD does NOT do

- Does not implement kiosk mode
- Does not implement Twilio integration for SMS (still stubbed)
- Does not implement E2E coverage (PRD-30)
- Does not change PRD-25/26/27 UI flows beyond adding the banner + handoff screen
- Does not author any new tenant-facing copy beyond the banner

## Affected files

### Migration
- `supabase/migrations/{stamp}_pbv_signature_events_assisted_by.sql`

### Modified
- `lib/auth.ts` / impersonation context — extend to carry `assisted_mode` info
- `app/api/admin/impersonate/route.ts` — accept `mode = 'pbv_assisted'`
- `components/admin/ImpersonationBanner.tsx` — recognize new mode (admin-side)
- `lib/tenantFetch.ts` — forward `X-Assisted-By` header from session
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts` (and `sign-summary/route.ts`) — read header, persist `assisted_by_staff_user_id`
- `app/admin/pbv/full-applications/[id]/page.tsx` — add Start/End assisted session buttons

### New components
- `components/pbv/AssistedBanner.tsx` (tenant-side)
- `components/pbv/AssistedHandoffPrompt.tsx`

### Tests
- API test: sign-form with `X-Assisted-By` writes correct `assisted_by_staff_user_id`
- Integration test: staff impersonate → tenant flow → sign → audit row shows both signer + assistant

## Phases

### Phase 1 — Schema + audit plumbing

- Migration
- API middleware updates
- Test: assisted sign writes correct event row
- Commit: `feat(pbv-assisted): schema + audit plumbing for staff-assisted sigs`

### Phase 2 — Tenant-side banner + handoff prompt

- AssistedBanner component
- AssistedHandoffPrompt before signature pad
- Tenant fetch carries header
- Commit: `feat(pbv-assisted): tenant banner + handoff prompt`

### Phase 3 — Admin-side controls

- Start/End assisted session buttons in `[id]/page.tsx`
- Session lifecycle (begin/extend/end) wired through impersonation
- Commit: `feat(pbv-assisted): admin-side session controls`

### Phase 4 — Integration test

- Staff starts assisted session for a tenant, fills intake, hands off, tenant signs → audit shows correct signer + assistant
- Commit: `test(pbv-assisted): integration coverage`

### Phase 5 — Build report

`docs/build-reports/29-pbv-form-execution-staff-assisted-build-report_2026-05-15.md`.

## Out of scope

- Kiosk mode
- Twilio SMS
- E2E browser tests (PRD-30)

## Acceptance criteria

- Staff can start assisted session from admin view
- Tenant UI shows AssistedBanner throughout
- At signing time, handoff confirmation precedes signature pad
- `pbv_signature_events.assisted_by_staff_user_id` populated correctly on every event in an assisted session
- `device_owner = 'staff_assisted'` on those events
- Tenant signature is the tenant's, not staff's (no way to bypass this)
- Tests pass; build clean

## Open questions

- Whether the staff member needs explicit consent capture from the tenant ("I confirm Will is helping me with this") at session start. Default: no — the operational reality is the tenant asked Will for help; capturing explicit consent adds friction.
- Whether the AssistedBanner persists across page refreshes. Default: yes, until explicit end.
- Whether multiple staff can sequentially assist the same tenant in one application. Default: yes; each session gets its own start/end; events tagged by the active staff at sign time.
