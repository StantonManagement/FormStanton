# PRP-004 — Env Validation, Health Check & Runtime Bootstrap

**Assigned batch (per BATCH_PLAN.md):** 01
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — findings **I1** (Critical), **I2** (High), **I3** (Medium).
**Depends on:** None — operates on current `main`. (Assumes current `main` already enforces mandatory cron auth, i.e. cron routes 401 when `CRON_SECRET` is unset. This PRP makes a deploy *fail loudly* when that secret is missing, rather than silently breaking every cron run.)
**Inputs (read before editing):** `scripts/validate-env.ts` (esp. the required-vars list ~35–56 and the Vercel early-exit ~8–11), the existing Supabase server-client factory, and the shared request entry point used by tenant/admin routes.
**Outputs (write — the ONLY files this PRP may modify/create):** `scripts/validate-env.ts`; new `lib/env/runtimeCheck.ts`; new `app/api/health/route.ts`; new test(s).
**Acceptance criteria:**
- `validate-env` (local/CI) fails when `CRON_SECRET` is missing or too short.
- `GET /api/health` returns 200 `{status:'ok', checks:{supabase:...}}` when healthy, 503 with the failing check otherwise; no auth, no secrets/PII in the body.
- A memoized `assertRuntimeEnv()` fails loudly (503 + clear log naming the missing var) in production when a required runtime var is absent.

## Context (self-contained)
`scripts/validate-env.ts` validates `SESSION_SECRET`/`SUPABASE_*`/etc. but **not** `CRON_SECRET`; since cron auth is mandatory, a deploy with `CRON_SECRET` unset silently 401s every cron run. The script also early-exits on Vercel (env is runtime-only there), so a missing required var surfaces only at the first request that needs it. There is no health endpoint to probe Supabase connectivity.

## Problem
- **I1:** `CRON_SECRET` not in the required-vars list.
- **I2:** no `/api/health`.
- **I3:** build-time validation skipped on Vercel → opaque first-request failures.

## Goals
1. Add `CRON_SECRET` to `requiredVars` with a min-length (≥16) validator; local/CI fails without it. Keep the existing Vercel early-exit (local/CI is where it gates).
2. `lib/env/runtimeCheck.ts`: memoized `assertRuntimeEnv()` that, in production, asserts the required runtime vars (derive from one shared `REQUIRED_ENV` source if low-risk, else duplicate with a linking comment) and fails loudly (structured 503 + log) on a missing var. Runs once per instance.
3. `app/api/health/route.ts`: unauthenticated `GET` — call `assertRuntimeEnv()` (cheap), then a short-timeout Supabase ping (reuse the existing server client; `select 1`-equivalent / tiny head query, 2–3s timeout); 200/503 with a per-check status object; never leak secrets.

## Non-goals
- No secret values in responses/logs. No monitoring-provider wiring. No change to cron auth logic. Keep `/api/health` cheap (not a full dependency sweep).
- Do not edit files outside the Outputs list.

## Implementation
1. Add `CRON_SECRET` (min-length) to `validate-env`.
2. `lib/env/runtimeCheck.ts` memoized assert; invoke from `/api/health` always and from the single shared request entry once-memoized (confirm there is one shared entry; do not scatter).
3. `app/api/health/route.ts` probe.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` on the touched paths — `assertRuntimeEnv` (missing var → structured failure; all present → ok, memoized); health route (ping ok → 200, ping fail → 503, no secret in body); if `validate-env` is unit-testable, a missing `CRON_SECRET` fails (else document `node scripts/validate-env.ts` with `CRON_SECRET` unset → non-zero exit).
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** preview `curl /api/health` → 200 with `supabase:ok`; bad Supabase URL → 503 naming the check; CI `validate-env` with `CRON_SECRET` unset → fails (this is the gate that would have caught the original cron blocker).
