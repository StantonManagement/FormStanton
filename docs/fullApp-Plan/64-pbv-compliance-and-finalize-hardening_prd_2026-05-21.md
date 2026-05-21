# PRD-64 — PBV Compliance & Finalize Hardening

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening`
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane (audit-log integrity is a HACH compliance signal; a missing submission event is a broken audit timeline)
**Source:** `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` — implements findings **#4** (X-Assisted-By forgery) and **#10** (non-atomic finalize event). Subset of audit fix-group **PR-E**.
**Scope guard:** This PRD is security + atomicity only. The full sign-form unification / hash-verification refactor (audit #1, #2, #3, #5, #6, #8) is **PRD-62** — do **not** touch it here.

---

## Problem Statement

Two quiet audit-integrity defects in the PBV full-app finalization lane:

**#4 — `X-Assisted-By` is trusted with an existence-only check.** [app/api/t/[token]/pbv-full-app/sign-form/route.ts:67-78](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L67) reads the `X-Assisted-By` header, looks the value up in `admin_users`, and if **any row exists** writes that staff user's id into `pbv_signature_events.assisted_by_staff_user_id`. There is no check that the named staff member is actually assisting *this* tenant *right now*. Any client that can reach the tenant API can spoof the header with any admin user id and the audit log records "staff X assisted this signature" when staff X did nothing. Staff-assisted signing ceremonies are a HACH compliance signal — the audit must be tamper-evident.

**#10 — `finalize` writes the submission event non-atomically.** [app/api/t/[token]/pbv-full-app/finalize/route.ts:49-69](app/api/t/[token]/pbv-full-app/finalize/route.ts#L49) sets `submitted_at` first, then writes the `application.submitted` event inside a `try/catch` that **only logs** on failure. If `writePbvApplicationEvent` throws, the application is submitted but `application_events` has no submission row — the audit timeline ends mid-flight and event-replay can't reconstruct the submit.

---

## Root cause / findings (confirmed in code 2026-05-21)

### #4 — a real staff session exists; the route just doesn't verify against it
There **is** a verifiable staff-session mechanism — this is not a "no session to check against" situation.

| Piece | Where | What it gives us |
|---|---|---|
| `assistedMode` on the iron-session | [lib/auth.ts:18-23](lib/auth.ts#L18) (`AssistedModeState`), [lib/auth.ts:36](lib/auth.ts#L36) | `{ staffUserId, staffDisplayName, applicationId, startedAt }` |
| Session reader | [lib/auth.ts:62-65](lib/auth.ts#L62) `getSession()` | reads the `admin_session` iron-session cookie |
| Session writer | [app/api/admin/pbv/full-applications/[id]/assisted-session/route.ts:45-51](app/api/admin/pbv/full-applications/[id]/assisted-session/route.ts#L45) | staff POST sets `session.assistedMode` (server-side, from `getRealSessionUser()`) |
| The verification pattern already in use | [app/api/t/[token]/pbv-full-app/assisted-mode/route.ts:42-55](app/api/t/[token]/pbv-full-app/assisted-mode/route.ts#L42) | reads `session.assistedMode`, confirms `am.applicationId === app.id` before trusting it |
| Header origin | [lib/tenantFetch.ts:31](lib/tenantFetch.ts#L31) | `X-Assisted-By` is emitted client-side from `assistedByUserId` — **not** authoritative |

The `assisted-mode` GET route already proves the exact check the sign-form route is missing. The fix is to apply the same `getSession().assistedMode` verification at the write site. **[Inference]** Because the iron-session cookie is httpOnly and signed with the server secret (`sessionOptions`, [lib/auth.ts:52-60](lib/auth.ts#L52)), a tenant-only client cannot mint a session — so a session-bound check is genuinely stronger than the existence check, not cosmetic.

### #10 — the event write is best-effort after the state mutation
`submitted_at` lands first ([finalize/route.ts:49-52](app/api/t/[token]/pbv-full-app/finalize/route.ts#L49)); the event write is in a swallowing `try/catch` ([finalize/route.ts:59-69](app/api/t/[token]/pbv-full-app/finalize/route.ts#L59)). `writePbvApplicationEvent` is a single `application_events` insert plus an in-process `_notifySubscribers` call ([lib/events/application-events.ts:450-461](lib/events/application-events.ts#L450)). `application.submitted` has **no** registered notification subscriber today ([lib/notifications/init.ts](lib/notifications/init.ts) dispatches generically; no submit trigger found), so the subscriber call is currently a no-op for this event — relevant to the SQL-function option below.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Existence-only `X-Assisted-By` trust | `sign-form/route.ts:67-78` | writes `assisted_by_staff_user_id` on `admin_users` existence alone |
| Verifiable staff session | `lib/auth.ts:18-23,62-65`; `assisted-mode/route.ts:42-55` | the thing to verify against; pattern already demonstrated |
| Non-atomic submit event | `finalize/route.ts:47-69` | `submitted_at` then best-effort event |
| Event write primitive | `lib/events/application-events.ts:388-461` | `writeApplicationEvent` / `writePbvApplicationEvent`; throws on insert error |
| `application_events` schema | `supabase/migrations/20260513160000_document_lifecycle_phase1.sql:52-62` + polymorphic anchor in `20260513200000_application_events_generalize.sql` | columns: `anchor_type`, `anchor_id`, `event_type`, `actor_user_id`, `actor_display_name`, `document_id`, `payload`, `created_at` |
| SQL-function precedent | `supabase/migrations/20260513000001_hap_execution_function.sql` | `SECURITY DEFINER` plpgsql, `GRANT EXECUTE ... TO service_role`, `RAISE` on error for rollback — mirror this style |
| Lock-on-submit guard | `lib/pbv/tenantEndpoint.ts:42-47` | `withTenantContext` already 409s when `submitted_at` is set, so finalize is single-shot per app |

---

## Goals

1. **#4:** `assisted_by_staff_user_id` is written only when the `X-Assisted-By` value matches the **current request's** active assisted session — i.e. `session.assistedMode.staffUserId === X-Assisted-By` **and** `session.assistedMode.applicationId === app.id`. A spoofed header with no matching session does not produce a forged audit row.
2. **#4:** When `X-Assisted-By` is present but cannot be verified against an active staff session, the route **rejects with 401** and logs a structured warning — it does not silently downgrade to a self-signed event, and does not write a staff attribution.
3. **#10:** A submitted application **always** has its `application.submitted` event. The submit and the event either both land or neither does.
4. No behavior change for the normal (non-assisted) tenant signing path: a request with **no** `X-Assisted-By` header signs as `device_owner='self'` with `assisted_by_staff_user_id=null`, exactly as today.

## Non-goals

- No sign-form unification, no `completeForm.ts` collapse, no `typed_name` plumbing, no document-hash verification (audit #1/#2/#3/#6/#8 → **PRD-62**).
- No new staff-portal UI; assisted-session start/stop ([assisted-session/route.ts](app/api/admin/pbv/full-applications/[id]/assisted-session/route.ts)) is unchanged.
- No change to the member-token signer route (it hard-codes `assisted_by_staff_user_id=null` and has no assisted path).
- Do **not** apply any migration to prod (per BATCH-RUN-PROTOCOL).

---

## Implementation phases

### Phase 1 — #4: verify `X-Assisted-By` against the active staff session
In `sign-form/route.ts`, replace the existence-only block ([lines 67-78](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L67)):

1. Read `X-Assisted-By`. If **absent** → `assistedByStaffUserId = null`, proceed unchanged (the self path).
2. If **present**, load the staff session with `getSession()` (from `@/lib/auth`) and read `session.assistedMode`.
3. Verify **all** of:
   - `assistedMode` exists, and
   - `assistedMode.staffUserId === assistedByHeader`, and
   - `assistedMode.applicationId === app.id`.
4. If verified → set `assistedByStaffUserId = assistedMode.staffUserId`. (The existing `admin_users` existence lookup may be kept as a cheap sanity check, but it is **not** the authorization — the session match is.)
5. If **not** verified → return **401** with `{ success: false, code: 'assisted_session_unverified' }` and `console.warn` a structured line (`{ event: 'assisted_by_unverified', header_value: assistedByHeader, app_id: app.id, has_session: !!assistedMode }`). Do **not** fall back to a self-signed event — the client asserted staff assistance, so failing closed is the correct compliance posture.

Frame in code comments as audit-integrity (HACH-facing), not a cosmetic check. Remove the now-misleading "Validate that this staff user exists in admin_users before trusting it" comment.

**[Inference]** This is the strongest option achievable with what the codebase already has — a real, signed, server-written session — so we take the session-verification path, not the 401-only stopgap and not a new HMAC scheme. If, in implementation, `getSession()` turns out to be unreadable from this tenant route (e.g. cookie scoping prevents the `admin_session` cookie from reaching `/api/t/...`), fall back to the **401 + structured-warning stopgap for any present `X-Assisted-By`** and log a **BLOCKER** in OPEN-DECISIONS that a proper staff-session or HMAC-proof verification is still needed — do **not** leave the existence-only check in place silently.

### Phase 2 — #10: atomic submit + event (preferred: SQL function)
Add a `SECURITY DEFINER` plpgsql function `finalize_pbv_application(p_app_id uuid, p_submitted_at timestamptz, p_actor_display_name text)` that, in one transaction:
- `UPDATE pbv_full_applications SET submitted_at = p_submitted_at WHERE id = p_app_id AND submitted_at IS NULL`;
- `INSERT INTO application_events (anchor_type, anchor_id, event_type, actor_user_id, actor_display_name, payload)` with `('pbv_full_application', p_app_id, 'application.submitted', NULL, p_actor_display_name, jsonb_build_object('submitted_at', p_submitted_at))`;
- `RAISE` on any error so the whole thing rolls back (mirror `execute_hap_transaction`).

In `finalize/route.ts`, replace the separate update + best-effort event ([lines 49-69](app/api/t/[token]/pbv-full-app/finalize/route.ts#L49)) with a single `supabaseAdmin.rpc('finalize_pbv_application', { … })`; on RPC error return **500** and leave the app unsubmitted.

Write the function as a migration `supabase/migrations/<ts>_finalize_pbv_application_fn.sql` — **commit only, do not apply to prod**, and list it in OPEN-DECISIONS.

**Fallback if the SQL function is not viable in-session** (e.g. cannot validate the function compiles without DB access, or `application.submitted` must keep firing the in-process notification subscriber): take the **event-first** code-only path instead — write the event **before** `submitted_at`, return 500 if the event throws so the app stays unsubmitted, then write `submitted_at`. Default-and-log which path was taken in the build report + OPEN-DECISIONS.

**Subscriber note (log either way):** the SQL-function path bypasses `_notifySubscribers` ([application-events.ts:459](lib/events/application-events.ts#L459)). `application.submitted` has no subscriber today so this is currently neutral, but it is a forward-looking divergence — record it in OPEN-DECISIONS so a future submit-notification isn't silently dropped.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (#4 rejected):** unit test — a `sign-form` request carrying `X-Assisted-By` with **no** matching `session.assistedMode` (or a mismatched `staffUserId` / `applicationId`) is rejected (401, `assisted_session_unverified`) and writes no `assisted_by_staff_user_id`.
- **Gate 2 (#4 ignored when absent):** unit test — a request with **no** `X-Assisted-By` header signs as before (`assisted_by_staff_user_id=null`); the verification code is not triggered.
- **Gate 3 (#4 accepted when valid):** unit test — header value === `session.assistedMode.staffUserId` and `assistedMode.applicationId === app.id` → `assisted_by_staff_user_id` is set to that staff id.
- **Gate 4 (#10 atomic / event-first):** unit/integration test — when the submission-event write fails, `submitted_at` is **not** set (app stays unsubmitted) and the route returns 500; on success, both the event and `submitted_at` land.
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; new tests green.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** apply the migration on a preview/staging DB and confirm `finalize_pbv_application` runs and rolls back on a forced event failure (needs a deployed DB).
- **Gate R2:** live staff-assisted ceremony walk — start an assisted session via the staff portal, sign one form, confirm `assisted_by_staff_user_id` is recorded; then replay the same `X-Assisted-By` without a session and confirm 401 (needs a deploy + staff login).

---

## Open questions

- **O1 (#4):** Can the `admin_session` iron-session cookie be read from a `/api/t/[token]/...` route handler? The `assisted-mode` GET route reads it successfully ([assisted-mode/route.ts:42](app/api/t/[token]/pbv-full-app/assisted-mode/route.ts#L42)), which is strong evidence it works — confirm during build; if not, take the 401-stopgap + BLOCKER per Phase 1.
- **O2 (#10):** SQL function vs event-first code path — default to the SQL function (preferred per audit #10); fall back to event-first if the function can't be validated in-session. Log the choice.

## Decisions

- **D1 (#4):** Session-verification is the chosen mechanism (not 401-only, not HMAC) because a real signed staff session already exists. Fail **closed** (401) when `X-Assisted-By` is present but unverifiable — never forge or downgrade-to-self.
- **D2 (#10):** SQL function `finalize_pbv_application` is the preferred fix (atomic, also closes the submit/event timestamp race). Migration committed, not applied.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | 1 | replace existence-only `X-Assisted-By` block with `getSession().assistedMode` verification; 401 + structured warn on unverified |
| `supabase/migrations/<ts>_finalize_pbv_application_fn.sql` | 2 | new `finalize_pbv_application(...)` SQL function — **commit only, list in OPEN-DECISIONS, do not apply** |
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | 2 | call `rpc('finalize_pbv_application', …)` (or event-first fallback); 500 on failure, app stays unsubmitted |
| new test(s) (e.g. `lib/__tests__/pbv-assisted-by-verify.test.ts`, finalize atomicity test) | 1, 2 | Gates 1–4 |

If anything outside this list needs changing, default-and-log per BATCH-RUN-PROTOCOL rather than expanding into PRD-62's scope.
