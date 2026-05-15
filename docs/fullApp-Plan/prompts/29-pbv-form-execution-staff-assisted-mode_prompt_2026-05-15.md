# Cursor/Windsurf Prompt — PRD-29: Staff-Assisted Mode Polish

## Context

Will (and other staff) supports ~30% of households who can't complete the digital flow alone. Staff fills intake on behalf, but signatures are always the tenant's. This pass adds the banner, the handoff prompt, and the audit hooks.

Reuses existing impersonation infrastructure — don't reinvent.

## Required reading

1. `docs/fullApp-Plan/29-pbv-form-execution-staff-assisted-mode_prd_2026-05-15.md`
2. `components/admin/ImpersonationBanner.tsx` — existing impersonation banner
3. `app/api/admin/impersonate/route.ts` — existing impersonation API
4. `lib/auth.ts` and `lib/adminAuthContext.tsx`
5. `app/api/t/[token]/pbv-full-app/sign-form/route.ts` (built in PRD-24/26) — where to read `X-Assisted-By`

## Closed decisions

- Use existing impersonation as the base; extend with `mode = 'pbv_assisted'`
- Signature is always the tenant's — no exceptions, no bypass
- `device_owner = 'staff_assisted'` + `assisted_by_staff_user_id` on every signature event in assisted session
- AssistedBanner visible throughout the assisted session
- Handoff confirmation before signature pad
- No kiosk mode in this PRD

## Build this pass

### Commit 1 — Schema + audit

- Migration adding `pbv_signature_events.assisted_by_staff_user_id`
- API middleware reads `X-Assisted-By` header on sign-form / sign-summary, validates against active impersonation session, writes the column
- API test
- Commit: `feat(pbv-assisted): schema + audit plumbing`

### Commit 2 — Tenant banner + handoff prompt

- `components/pbv/AssistedBanner.tsx` — always-visible top banner with staff name + end session button
- `components/pbv/AssistedHandoffPrompt.tsx` — shown before signature pad, "Hand the phone to {tenant}"
- `tenantFetch.ts` forwards `X-Assisted-By` from session context
- Commit: `feat(pbv-assisted): tenant banner + handoff prompt`

### Commit 3 — Admin controls

- "Start assisted session" / "End session" buttons in `app/admin/pbv/full-applications/[id]/page.tsx`
- Session lifecycle wired through impersonate route with `mode = 'pbv_assisted'`
- Active-session indicator in admin
- Commit: `feat(pbv-assisted): admin-side session controls`

### Commit 4 — Integration test

- Vitest: staff starts assisted session, fills intake, signature events get correct `assisted_by_staff_user_id` and `device_owner = 'staff_assisted'`
- Commit: `test(pbv-assisted): integration coverage`

## Verification

- Schema migration applies cleanly
- Tenant API correctly writes both columns on assisted sigs
- Banner shows + handoff prompt fires before signature pad
- Tests + build clean

## Anti-patterns — do NOT

- Do not let staff sign on behalf of tenant
- Do not disable the banner during assisted session
- Do not bypass the handoff prompt
- Do not implement kiosk mode
- Do not duplicate impersonation infrastructure — extend it

## Build report

`docs/build-reports/29-pbv-form-execution-staff-assisted-build-report_2026-05-15.md`. Cover: schema change, banner UX, handoff flow, audit verification, open questions.

## When you're done

- 4 commits, build report committed, tests + build clean
- Surface to Alex; wait for sign-off before PRD-30
