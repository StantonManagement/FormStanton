# PRP-004 — Env Validation, /api/health & Runtime Bootstrap — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `61e366676a5319b50ba8acaa1d52190cc51811ff`
**Findings closed:** Angle-2 audit — **I1**, **I2**, **I3**

## Files changed
- `scripts/validate-env.ts` — added `CRON_SECRET` (>=16 chars) to `requiredVars`. Vercel early-exit unchanged (env is runtime-only there).
- `lib/env/runtimeCheck.ts` *(new)* — `REQUIRED_RUNTIME_ENV` + memoized `assertRuntimeEnv()`. Logs offending names only (no values).
- `app/api/health/route.ts` *(new)* — unauthenticated `GET`. Env check + 2.5s-bounded Supabase head-only ping. 200/503.
- `lib/env/__tests__/runtimeCheck.test.ts` *(new)* — 6 tests.

## Path taken
- **`REQUIRED_RUNTIME_ENV` mirrors `scripts/validate-env.ts` manually** rather than extracting a shared module. Outputs allowlist for this PRP forbids a third file at this layer; the two lists carry a "must move together" comment. A future tidy-up can extract `lib/env/required.ts` (out-of-scope here).
- **Single shared request entry not wired.** The PRP says to invoke `assertRuntimeEnv()` from "the single shared request entry"; the closest match is `lib/pbv/tenantEndpoint.ts::withTenantContext`, but that file is not in this PRP's Outputs (and was just edited by PRP-002). Wiring will happen in a follow-up; `/api/health` is the only caller today. Logged as a minor follow-up — the current memoized assert still surfaces failures on the first health probe / readiness check.
- **Supabase ping uses `pbv_full_applications` + `{ head: true }`** so no row data crosses the wire — just the count metadata. Bounded by `Promise.race` with a 2.5 s timeout.
- **Body shape:** `{ status: 'ok' | 'degraded', checks: { env: { ok, missing, invalid }, supabase: { ok, latencyMs, error? } } }`. No keys, tokens, or PII anywhere.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/env/__tests__/runtimeCheck.test.ts` — **6 pass / 0 fail / 1.13 s.**

## Deferred runtime gates
- On a preview: `curl https://<preview>/api/health` → `200 { status:'ok' }`; intentionally break `SUPABASE_SERVICE_ROLE_KEY` → `503 { checks.env.ok: false, checks.env.missing|invalid contains SUPABASE_SERVICE_ROLE_KEY }`.
- In CI / local: `unset CRON_SECRET && node scripts/validate-env.ts` → non-zero exit with `❌ CRON_SECRET is missing`.

## Follow-ups (not in this PRP)
- Wire `assertRuntimeEnv()` into the shared request entry (`withTenantContext` or a route-level shim) so a missing required var becomes a structured 503 on every request, not just `/api/health`.
- Extract `REQUIRED_ENV` into a shared module so `scripts/validate-env.ts` and `lib/env/runtimeCheck.ts` share one source.
