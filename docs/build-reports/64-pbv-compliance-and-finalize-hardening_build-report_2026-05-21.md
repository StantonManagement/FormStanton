# PRD-64 — PBV Compliance & Finalize Hardening — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening`
**Commit:** PRD-64: compliance & finalize hardening

---

## What changed

| File | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | Replaced the existence-only `admin_users` lookup for `X-Assisted-By` with a `getSession().assistedMode` check. Verified mismatch on `staffUserId` and/or `applicationId` → 401 `assisted_session_unverified` + structured `console.warn` (`event: 'assisted_by_unverified'`). Request with **no** header still proceeds as before with `assistedByStaffUserId = null`. Old "Validate that this staff user exists in admin_users" comment replaced with an audit-integrity (HACH-facing) comment. |
| `supabase/migrations/20260521020000_finalize_pbv_application_fn.sql` | **NEW.** `SECURITY DEFINER` plpgsql `finalize_pbv_application(p_app_id uuid, p_submitted_at timestamptz, p_actor_display_name text)`. UPDATE `pbv_full_applications.submitted_at` + INSERT `application_events` row in one transaction; `RAISE` on error to roll back. `GRANT EXECUTE ... TO service_role`. **NOT APPLIED** — listed in OPEN-DECISIONS. |
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | Replaced the separate `update(submitted_at)` + best-effort `writePbvApplicationEvent` with `supabaseAdmin.rpc('finalize_pbv_application', {...})`. RPC error → 500 `finalize_atomic_failed`, app stays unsubmitted. Removed the now-unused `writePbvApplicationEvent` / `ApplicationEventType` imports. Header docstring updated. |
| `lib/pbv/__tests__/sign-form-assisted-by-verify.test.ts` | **NEW.** Structural assertions (same pattern as the PRD-62 unification test): route imports `getSession`, calls it, verifies both `staffUserId` and `applicationId`, returns 401 `assisted_session_unverified` on mismatch, and still lets a request through when no `X-Assisted-By` is present. |
| `lib/pbv/__tests__/finalize-atomicity.test.ts` | **NEW.** Drives the route POST handler with a mocked `supabaseAdmin` (toggling `.rpc` between success/error). Gate 4a (success → 200 + RPC invoked once), Gate 4b (RPC error → 500 + `finalize_atomic_failed` + no extra writes), and a replay-safety case proving `withTenantContext` 409s before any RPC call when `submitted_at` is already set. |

## Static gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1 — #4 rejected (header present, no/wrong session → 401) | ✅ PASS | Structural test asserts the 401 + `assisted_session_unverified` branch. |
| Gate 2 — #4 ignored when header absent (self path unchanged) | ✅ PASS | Test asserts `if (assistedByHeader)` gate and `assistedByStaffUserId: string \| null = null` default. |
| Gate 3 — #4 accepted when header === assistedMode.staffUserId + applicationId === app.id | ✅ PASS | Test asserts both equality checks. Runtime walk in R2 confirms end-to-end. |
| Gate 4 — #10 atomic / 500-on-failure | ✅ PASS | `finalize-atomicity.test.ts` 4a + 4b. On RPC error the route returns 500 with no fallback write attempts. |
| Gate 5 — `tsc --noEmit` + `npm run build` | ✅ PASS | tsc silent; build emits the full route table at exit 0. |

## Decisions logged (see OPEN-DECISIONS.md)

- `[PRD-64] X-Assisted-By verification` (D1) — session-verification path chosen over 401-stopgap, on the strength of the existing `assisted-mode` GET route reading the same cookie.
- `[PRD-64] Atomic finalize via SQL function` (D2) — SQL path preferred over event-first. Migration committed but **not applied** — must be applied **before** deploying the PRD-64 code (or every finalize 500s).
- `[PRD-64] SQL path bypasses _notifySubscribers` (informational) — `application.submitted` has no subscriber today; recorded so a future submit-notification feature doesn't get silently dropped.

## Prod migrations to apply

- `supabase/migrations/20260521020000_finalize_pbv_application_fn.sql` — additive function. **Apply BEFORE deploying the PRD-64 code change** (the route hard-calls the RPC).

## Deferred runtime gates (post-run verification pass)

- **Gate R1 — SQL atomicity on staging.** Apply the migration on a preview DB; force an event-insert failure (e.g. temporarily violate a constraint) and confirm both writes roll back — `submitted_at` reverts to NULL, `application_events` has no submission row.
- **Gate R2 — live staff-assisted ceremony walk.** Start an assisted session via the staff portal; sign one form. Expect `pbv_signature_events.assisted_by_staff_user_id` to be the staff id and `device_owner='staff_assisted'`. Then replay the same `X-Assisted-By` header without an assisted session and confirm 401 `assisted_session_unverified`.

## Out-of-lane (untouched)

- `lib/pbv/signing/completeForm.ts`, member-token signer route, `typed_name` plumbing, document-hash verification — all PRD-62 territory.
- `app/api/admin/pbv/full-applications/[id]/assisted-session/route.ts` — assisted-session start/stop unchanged.
- `lib/tenantFetch.ts` — header emission is fine; PRD-64 fix is server-side verification only.

## Next

Proceed to PRD-65 prompt (`docs/fullApp-Plan/prompts/65-pbv-government-id-required-first_prompt_2026-05-21.md`).
