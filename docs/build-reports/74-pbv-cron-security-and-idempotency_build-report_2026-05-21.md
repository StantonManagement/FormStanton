# PRD-74 — Cron Security & Idempotency — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-stress-test-hardening`
**PRD:** `docs/fullApp-Plan/74-pbv-cron-security-and-idempotency_prd_2026-05-21.md`
**Audit findings remediated:** #1 (CRITICAL — deploy blocker), #9 (MEDIUM), #10 (MEDIUM)

## Deploy-blocker status

**#1 cleared at this commit.** Fail-open cron auth is replaced with a fail-closed helper in `lib/cron/auth.ts`. Unset `CRON_SECRET` → 401 + structured `cron_secret_unset` log; mismatch → 401; valid Bearer → handler runs. Each of the three cron routes calls the helper before doing any work.

## Files changed

**New:**
- `lib/cron/auth.ts` — `assertCronAuthorized(request)` fail-closed helper.
- `lib/cron/runLock.ts` — `claimCronRun(jobName, leaseSeconds)` (calls `claim_cron_run` RPC; fails-open on RPC error with `cron_claim_error` log so deploy-blocker fix is independent of Phase 3 migration apply).
- `lib/cron/reminderCadence.ts` — extracted pure helper `getNextReminderDate(currentDay, intakeSubmittedAt)` so it is unit-testable.
- `lib/cron/__tests__/auth.test.ts` — 4 tests (unset / wrong / missing / valid).
- `lib/cron/__tests__/reminderCadence.test.ts` — 7 tests (cadence anchoring, null/invalid intake, anchor invariance).
- `supabase/migrations/20260521080000_cron_run_locks.sql` — claim table + `claim_cron_run(job_name, lease_seconds)` SECURITY DEFINER function. **Commit-only.**

**Edited:**
- `app/api/cron/pbv-deferred-reminders/route.ts` — calls `assertCronAuthorized` + `claimCronRun('pbv-deferred-reminders', 600)`; cadence anchored to `app.intake_submitted_at` at both call sites; helper moved to `lib/cron/reminderCadence.ts`.
- `app/api/cron/cleanup-idempotency-keys/route.ts` — same auth + `claimCronRun('cleanup-idempotency-keys', 120)`.
- `app/api/cron/notifications/scheduled-sends/route.ts` — same auth + `claimCronRun('notifications-scheduled-sends', 300)`.

## Path taken — preferred everywhere

- **Phase 1 (#1):** preferred — centralized helper, fail-closed default, returns 401 on missing secret.
- **Phase 2 (#9):** preferred — extracted pure helper, anchored to `intake_submitted_at`. Both call sites updated.
- **Phase 3 (#10):** preferred — connection-independent claim table via `claim_cron_run` RPC, with a lease. NOT the session-level `pg_advisory_lock` fallback (which is unreliable through PostgREST pooling). Migration is commit-only per the protocol.

## OPEN-DECISIONS entries added

1. **[PRD-74] Phase 3 run-lock applied to all three cron routes — DECISION (O1):** consistency over micro-optimization; `cleanup-idempotency-keys` gets the lock even though a double-run there is harmless.
2. **[PRD-74] `claimCronRun` fails open when the RPC errors — DECISION:** lets the deploy-blocker fix ship independently of the migration apply. Once the migration is applied, leases are enforced.
3. **[PRD-74] 401 on unset CRON_SECRET — DECISION (O2 default):** matches the audit posture.
4. **[PRD-74] `20260521080000_cron_run_locks.sql` — MIGRATION-TO-APPLY.**

## Static gates

| Gate | Result |
|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ Clean |
| `npx vitest run lib/cron/__tests__/` | ✅ 11/11 (2 files) |
| `npm run build` | ✅ Clean |

## Deferred runtime gates (post-run manual pass)

- **R1 (#1 negative):** hit each cron route in a deployed preview with no Authorization header → 401.
- **R2 (#1 positive):** hit each cron route with `Authorization: Bearer <CRON_SECRET>` → 200 (or 200 + `skipped:true` if a parallel run holds the lease).
- **R3 (#10):** after `20260521080000_cron_run_locks.sql` is applied on staging, fire two near-simultaneous `pbv-deferred-reminders` invocations and confirm one run + one skip (look for `cron_skipped_locked` in the second's logs).
- **R4 (Phase 2 sanity):** on staging, confirm that delaying a cron run by 24 h does not slide the cadence — the next reminder still fires `nextDay - elapsedDay` days after the intake date, not 24 h late.

## Notes

- The migration is **commit only**; it has not been applied to `lieeeqqvshobnqofcdac`. Until applied, `claimCronRun` logs `cron_claim_error` and proceeds — the cron is still secure (Bearer enforced) but does not deduplicate parallel regional runs.
- Operational: confirm `CRON_SECRET` is set in **prod and preview** env vars, and that the Vercel cron invocation sends `Authorization: Bearer <CRON_SECRET>`. Without this, every cron run will 401 (intentional — fail-closed).
