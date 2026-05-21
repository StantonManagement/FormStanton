# PRD-82 — PBV Member-Token Signer Round 2

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Status:** Draft — ready for build
**Severity:** P1/P2. A4 is a workflow-integrity gap (a non-HOH adult on a magic link can keep viewing forms and signing after staff lock the packet) — the matrix lists it "Fix in v1.1". A12 is robustness (case-sensitive string matching for the 404-vs-422 status decision).
**Source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` — findings **A4** (HIGH) and **A12** (MEDIUM). Grouped because both live in the magic-link signer lane (the `signer/[member_token]/*` routes), and A12's typed-error change lands in `completeForm.ts` which this PRD owns.
**Scope guard:** `app/api/pbv-full-app/signer/[member_token]/route.ts`, `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`, `app/api/pbv-full-app/signer/[member_token]/forms/route.ts`, and `lib/pbv/signing/completeForm.ts`. Do **not** touch the tenant routes, `withTenantContext` (PRD-77), `lib/pbv/magicLinkExpiry.ts` / `validateSignFormBody.ts` (PRD-78/77 own those — import, don't edit), or the signature/capture routes (PRD-80).

**Dependencies:**
- Runs **after PRD-78** (which edits `signer/[member_token]/route.ts` and `sign-form/route.ts` for the expiry helper + member-route input validation). This PRD layers `packet_locked` + typed-error changes on top of PRD-78's version of those files. If PRD-78 has not landed, build on the current files and note the reorder.
- Reuses PRD-77's `validateSignFormBody` (already applied to the member route by PRD-78) — no new validation here.

---

## Problem Statement

**A4 — Member-token signer routes do not check `packet_locked` (per audit, [signer/[member_token]/sign-form/route.ts:67](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L67) + `signer/[member_token]/route.ts`).** The member-token routes check `submitted_at` but **never check `packet_locked`**. PRD-77 centralizes the `packet_locked` gate in `withTenantContext` — but the magic-link signer lane does **not** flow through `withTenantContext` (it resolves the application via the member token, not the tenant token). So if staff lock the packet while a non-HOH adult is on their magic link, that signer can still view forms and sign. This is the same gate PRD-77 added for the tenant lane, missing from the magic-link lane.

**A12 — Member-token `sign-form` returns the wrong status for "not found" errors (per audit, [signer/[member_token]/sign-form/route.ts:93-98](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L93)).** The 404-vs-422 decision uses `result.error?.includes('not found')`, but `completeFormSigning` returns the string `'Form document not found'` (capital F). The `.includes()` is case-sensitive and brittle — a wording change to the error string silently breaks the status mapping.

---

## Root cause / findings (audit-reported; confirm in code before editing)

- **A4**: the `packet_locked` gate lives in two places after PRD-77 — `withTenantContext` (tenant lane) and the upload route's local check. The magic-link lane has neither. Because these routes resolve the app row from the member token, the gate must be added to **the member→application lookup** in each route: fetch `packet_locked` on the joined application and 409 when true. Confirm how each route currently loads the application (the join/select shape) so `packet_locked` is fetched regardless of the existing select.
- **A12**: string-`includes` matching is the root issue. The robust fix is a **typed error code** on `completeFormSigning`'s result. To avoid forcing a change in the tenant `sign-form` route (PRD-77's file) that also calls `completeFormSigning`, the change is **additive**: add an optional `errorCode` field to the result without removing the existing `error` string. The member route switches to `result.errorCode`; the tenant route keeps working unchanged. [Inference] an additive field preserves all existing callers; confirm the current return type of `completeFormSigning` and every call site before changing it.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| No `packet_locked` check | `signer/[member_token]/sign-form/route.ts:67`, `signer/[member_token]/route.ts`, `forms/route.ts:25-35` | only `submitted_at` checked |
| Tenant-lane gate (reference) | `withTenantContext` (PRD-77) | 409 `packet_locked`; member lane does not use this wrapper |
| Case-sensitive status mapping | `signer/[member_token]/sign-form/route.ts:93-98` | `result.error?.includes('not found')` vs `'Form document not found'` |
| `completeFormSigning` | `lib/pbv/signing/completeForm.ts` | returns a result with an `error` string; callers: tenant `sign-form` (PRD-77) + member `sign-form` (this PRD) |
| `packet_locked` column | `pbv_full_applications` | exists; set/cleared by `send-to-hach`/`reopen` |

---

## Goals

1. **A4:** Each member-token route (`route.ts` GET, `sign-form` POST, `forms` GET) returns **409** `{ success:false, code:'packet_locked' }` when the resolved application has `packet_locked = true`, so a magic-link signer cannot view forms or sign while staff hold the packet. The check uses the same message/shape as PRD-77's tenant gate for client consistency.
2. **A4:** `packet_locked` is fetched in each route's member→application lookup regardless of the existing select, so the gate cannot be bypassed by a query that omitted the column. Order per route: not-found/expired (existing) → `submitted_at` 409 (existing) → `packet_locked` 409 (new) → handler.
3. **A12:** `completeFormSigning` returns an additive, typed `errorCode` (e.g. `'not_found' | 'invalid' | ...`) alongside its existing `error` string. The member `sign-form` route maps status from `errorCode` (`'not_found' → 404`, else `422`) instead of `.includes('not found')`. The tenant `sign-form` route (PRD-77) is left unchanged and keeps compiling — confirm it does.
4. No change to the 410-on-expiry contract (PRD-78), the 409 `submitted_at` check, the `completeFormSigning` success path, or what gets written on a successful sign.

## Non-goals

- No change to the lock semantics (what sets/clears `packet_locked` — `send-to-hach`/`reopen`, unchanged).
- No change to the tenant `sign-form` route, `withTenantContext`, `validateSignFormBody.ts`, or `magicLinkExpiry.ts` (import/reuse only).
- No removal of `completeFormSigning`'s existing `error` string (additive only, to keep PRD-77's caller working).
- No new schema — `packet_locked` already exists.
- Do **not** apply any migration to prod (none expected).

---

## Implementation phases

### Phase 1 — A4: `packet_locked` gate in all three member-token routes
For each of `route.ts` (GET), `sign-form/route.ts` (POST), and `forms/route.ts` (GET):

1. Ensure the member→application lookup selects `packet_locked` (add it to the join/select; de-dupe if already present).
2. After the existing `submitted_at` 409 check, add:

```ts
if (app?.packet_locked) {
  return NextResponse.json(
    { success: false, message: 'This packet is currently under review. Please contact the Stanton office.', code: 'packet_locked' },
    { status: 409 }
  );
}
```

Match PRD-77's message/code so the tenant client's existing `packet_locked` handling applies to the magic-link client too. Confirm the variable that holds the resolved application row in each route (it may be named differently per route).

### Phase 2 — A12: additive typed error code on `completeFormSigning`
In `lib/pbv/signing/completeForm.ts`:

1. Confirm the current result type and every call site (grep `completeFormSigning(`).
2. Add an optional `errorCode` to the result type (do **not** remove `error`). Where the function currently sets `error: 'Form document not found'`, also set `errorCode: 'not_found'`; set appropriate codes for the other failure branches (`'invalid'`, `'already_signed'`, etc. — name them from the existing branches, don't invent new failure modes).

In `signer/[member_token]/sign-form/route.ts:93-98`, replace the string match:

```ts
const status = result.errorCode === 'not_found' ? 404 : 422;
```

Leave the tenant `sign-form` route untouched; verify it still type-checks against the additive change.

---

## Verification / test plan

**Static gates (in-session, before commit):**
- **Gate 1 (A4 locked):** unit test — each member route with a resolved app where `packet_locked = true` → 409 `packet_locked`, handler not invoked.
- **Gate 2 (A4 select):** unit test — a lookup whose base select omitted `packet_locked` still gets the gate (the route fetched it anyway).
- **Gate 3 (A4 unlocked):** unit test — `packet_locked = false`, `submitted_at = null` → route proceeds as today.
- **Gate 4 (A12 not_found):** unit test — `completeFormSigning` returns `errorCode:'not_found'` → member route responds 404.
- **Gate 5 (A12 other):** unit test — a non-not_found `errorCode` → 422.
- **Gate 6 (A12 caller-safety):** unit/type check — the tenant `sign-form` route still compiles and behaves unchanged against the additive result type.
- **Gate 7:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`). **No Playwright/e2e.**

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** on a preview deploy, lock a packet via `send-to-hach`, then open a member magic link → 409 `packet_locked` on view + sign; `reopen` → the signer can view/sign again.

---

## Open questions

- **O1 (A4):** Does each member route resolve the application the same way (same join), or do they differ? Confirm per route so `packet_locked` is fetched in each. Default: add it to each lookup's select.
- **O2 (A12):** What are `completeFormSigning`'s actual failure branches/strings today? Enumerate them and map each to a code; do not invent failure modes that don't exist.
- **O3 (A12):** Should the tenant `sign-form` route also adopt `errorCode` for consistency? Default: **no** in this PRD (it's PRD-77's file); log it as an optional follow-up.

## Decisions

- **D1 (A4):** Gate `packet_locked` in all three member-token routes, fetching the column regardless of the base select; reuse PRD-77's 409 shape.
- **D2 (A12):** Additive `errorCode` on `completeFormSigning`; member route maps status from it; existing `error` string and the tenant caller untouched.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `app/api/pbv-full-app/signer/[member_token]/route.ts` | A4 | fetch `packet_locked`; 409 `packet_locked` |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | A4, A12 | 409 `packet_locked`; map status from `result.errorCode` |
| `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | A4 | fetch `packet_locked`; 409 `packet_locked` |
| `lib/pbv/signing/completeForm.ts` | A12 | additive `errorCode` on the result (keep `error` string) |
| new test(s) | A4, A12 | Gates 1–6 |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md`. Do **not** edit the tenant routes, `withTenantContext`, or the PRD-77/78 helper files (import only).
