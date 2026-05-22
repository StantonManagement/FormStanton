# PRP-002 — Rate Limiting & Brute-Force Resistance

**Assigned batch (per BATCH_PLAN.md):** 01
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — findings **D2** (Critical), **D3** (High).
**Depends on:** None — operates on current `main`. (Assumes current `main` already has, in `lib/pbv/tenantEndpoint.ts`/`withTenantContext`, a 404 → submitted-locked 409 → packet_locked 409 ordering and a `validateSignFormBody` call in the sign-form route. **Do not remove those gates** — add the limiter *before* them.)
**Inputs (read before editing):** `lib/pbv/tenantEndpoint.ts` (the `withTenantContext` gate ordering), `app/api/pbv-full-app/signer/[member_token]/route.ts`, `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`, `package.json` + env (to detect a provisioned Redis/Upstash/KV store).
**Outputs (write — the ONLY files this PRP may modify/create):** new `lib/rateLimit.ts`; `lib/pbv/tenantEndpoint.ts`; `app/api/pbv-full-app/signer/[member_token]/route.ts`; `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`; new limiter test(s); (only iff lockout counter is stored in a column) one additive migration (commit-only).
**Acceptance criteria:**
- A store-backed limiter denies over-limit requests with **429** + `Retry-After`.
- Tenant routes inherit a default limit via `withTenantContext`, with tighter per-route limits for `generate-forms`/`finalize` (≤10/min/token) and `sign-form`/`sign-summary`/`signature/capture` (≤20/min/token), plus a per-IP backstop.
- Signer bootstrap + signer sign-form get per-IP limiting + lockout after N failed attempts.
- The limiter is **not** an in-memory `Map` used as the sole defense (see blocking decision).
- Existing gates (submitted-locked, packet_locked, body validation) are preserved and the limiter runs before the DB lookup.

## ⚠️ Blocking decision (resolve before/at build, log in BATCH_PLAN if unresolved)
A limiter is only real if its counter is **shared across serverless instances**. An in-memory `Map` resets per instance and does **not** limit a distributed attacker. Options: (a) Upstash/Redis (`@upstash/ratelimit` pattern), (b) Vercel KV/Edge Config, (c) in-memory — **insufficient as the sole defense.** If no shared store is provisioned, build the limiter behind a clean interface, wire it, and record this as an unresolved decision for Alex — **do not ship in-memory as if it were protection.**

## Context (self-contained)
No `/api/t/[token]/pbv-full-app/*` route is throttled; an attacker can brute-force the token space, flood the expensive `generate-forms` (heavy PDF stamping) / `finalize`, or spam `sign-form`. The member-token signer bootstrap (`signer/[member_token]/route.ts`) has a 122-bit UUID token but **no** rate limit and **no** lockout, so high-speed guessing/probing is unpenalized. `withTenantContext` in `lib/pbv/tenantEndpoint.ts` is the central wrapper every tenant route passes through — the natural single hook for tenant-side limiting.

## Problem
- **D2:** tenant API unthrottled (token brute-force, compute/DB exhaustion).
- **D3:** signer endpoints have no rate limit or lockout.

## Goals
1. `lib/rateLimit.ts`: `checkRateLimit({ key, limit, windowSec }) → { allowed, retryAfterSec, remaining }`, store-agnostic interface + one adapter for the chosen backend. On store-unreachable: **deny** the expensive routes (log an alarm); allow reads with a logged alarm (decide + log).
2. Wire into `withTenantContext` **before** the DB lookup, keyed by token+route(+IP), with per-route overrides (limits above). Over-limit → 429 + `Retry-After` + `{ success:false, code:'rate_limited' }`. Preserve the existing gate order (limiter → existing 404/locked/validation gates → handler).
3. Signer routes: per-IP limit on entry; a `failed_magic_link_attempts` counter; lock the token after ~10 failures for a cooldown; locked → 429/423 with a **generic** message (no token-validity oracle). Use Vercel's IP header (`x-vercel-ip*`) for the IP key.

## Non-goals
- No WAF/CAPTCHA. No global app-wide limiting beyond per-token/per-IP.
- No migration unless the lockout counter is a DB column (then additive, commit-only, never applied).
- Do not edit files outside the Outputs list; do not remove existing gates.

## Implementation
1. **Phase 0:** detect a shared store; if none, build behind the interface + record the blocking decision.
2. **Phase 1:** `lib/rateLimit.ts` (sliding/fixed window) + adapter + store-error behavior.
3. **Phase 2:** hook into `withTenantContext` before DB work; per-route override via the existing options; 429 + Retry-After.
4. **Phase 3:** signer routes — per-IP limit + failure counter + lockout + generic message.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run lib/__tests__/rateLimit*` — N allowed, N+1 denied + `retryAfter`; window reset re-allows; store-error path matches the chosen behavior; `withTenantContext` returns 429 when denied, limiter precedes the DB lookup, and the existing locked/validation gates still fire.
- **No full `npm run build` per PRP** (not build surface); the batch boundary runs it.
- **Deferred runtime gates:** on a preview with the real store, 25 rapid `sign-form` requests → ~20 then 429; repeated invalid signer-token requests from one IP → lockout/429 after threshold, generic message.
