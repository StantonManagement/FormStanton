# PRD-74 — PBV Cron Security & Idempotency

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-stress-test-hardening`
**Status:** Draft — ready for build
**Severity:** Phase 1 is **P0 — deploy blocker** (an unset `CRON_SECRET` leaves all cron routes open to anonymous triggering). Phases 2–3 are P2 (correctness / duplicate-run hardening).
**Source:** `docs/audits/pbv-stress-test-report_2026-05-21.md` — findings **#1** (CRITICAL), **#9** (MEDIUM), **#10** (MEDIUM). Grouped here because all three live in `app/api/cron/*` and #1 touches all three cron routes; splitting them would mean editing the same files in separate PRDs.
**Scope guard:** Cron routes only. No change to notification content, cadence values, the notification dispatch layer, or any tenant/admin route.

---

## Problem Statement

**#1 — Cron routes are open when `CRON_SECRET` is unset (CRITICAL).** All three cron handlers use the pattern `const secret = process.env.CRON_SECRET; if (secret) { …check Bearer… }`. The Bearer check is nested *inside* `if (secret)`, so when the env var is missing the entire auth block is skipped and the handler runs for any caller. Confirmed in code 2026-05-21:

| Route | Auth block |
|---|---|
| [app/api/cron/pbv-deferred-reminders/route.ts:112-118](app/api/cron/pbv-deferred-reminders/route.ts#L112) | `if (secret) { if (authHeader !== Bearer) 401 }` |
| [app/api/cron/cleanup-idempotency-keys/route.ts:14-20](app/api/cron/cleanup-idempotency-keys/route.ts#L14) | same |
| [app/api/cron/notifications/scheduled-sends/route.ts:22-28](app/api/cron/notifications/scheduled-sends/route.ts#L22) | same |

An anonymous caller could spam deferred reminders (flooding tenants with SMS/email), force-cancel/send scheduled notifications, or wipe idempotency keys mid-ceremony. This is a deploy blocker.

**#9 — Reminder cadence drifts from the application's start date (MEDIUM).** `getNextReminderDate(currentDay)` ([pbv-deferred-reminders/route.ts:35-49](app/api/cron/pbv-deferred-reminders/route.ts#L35)) computes the next reminder as `new Date()` (wall-clock now, line 44) plus the gap to the next cadence day. The base is the moment the cron happens to run, not the tenant's `intake_submitted_at`. If a cron run is delayed or the schedule restarts, the 3/7/14/21/28/35/42-day cadence slides relative to the tenant's actual intake date. [Inference] anchoring the cadence to a fixed point (`intake_submitted_at`) keeps the schedule stable across delayed runs; not yet test-verified.

**#10 — No guard against duplicate concurrent cron runs (MEDIUM).** Vercel can invoke a cron from more than one region, and the deferred-reminders handler holds no lock. Two overlapping runs both read the same `next_reminder_scheduled_at <= now` rows before either updates them, so a tenant can receive duplicate reminders in one window. The `scheduled-sends` route has the same exposure (it reads `status='pending'` rows then updates them, with no atomic claim). [Inference] a same-row double-read is possible under concurrent regional invocation because the read and the status update are separate statements; not reproduced in-session.

---

## Root cause / findings (confirmed in code 2026-05-21)

- **#1** is a structural mistake: fail-*open* on missing config. The correct posture for an unauthenticated edge route is fail-*closed* — no secret configured means no caller is authorized.
- **#9**: `getNextReminderDate` never receives the application row's `intake_submitted_at`, even though the cron already selects it ([pbv-deferred-reminders/route.ts:138](app/api/cron/pbv-deferred-reminders/route.ts#L138)). The data is in hand; the function just uses `new Date()` instead.
- **#10**: there is no advisory-lock or claim primitive in the cron handlers today. [Inference] PostgreSQL session-level advisory locks (`pg_advisory_lock`) are unreliable through Supabase's PostgREST connection pool because the lock is bound to a connection that may not be reused for the unlock — so a connection-independent claim (a small lock table with an atomic conditional update) is the safer mechanism. The build should confirm whether any cron-lock primitive already exists before adding one.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Fail-open auth (×3) | the three routes above | Bearer check nested in `if (secret)` |
| Cadence base = wall clock | `pbv-deferred-reminders/route.ts:44` | `const now = new Date()` inside `getNextReminderDate` |
| `intake_submitted_at` already selected | `pbv-deferred-reminders/route.ts:138` | available at both call sites (lines 183, 267) |
| No run lock | all cron routes | no advisory lock, no claim table |
| `scheduled-sends` claim pattern | `scheduled-sends/route.ts:32-37, 60-95` | reads `status='pending'`, updates after send — non-atomic |

---

## Goals

1. **#1:** Each cron route returns **401** when `CRON_SECRET` is unset **or** the Bearer header does not match. There is no path on which the handler body runs without a verified secret.
2. **#1:** The auth check is centralized in one helper so a future cron route cannot reintroduce the fail-open pattern.
3. **#9:** The reminder cadence is computed from `app.intake_submitted_at`, not wall-clock `now`, so a delayed or restarted cron does not shift the schedule.
4. **#10:** Each cron run acquires a connection-independent lock/claim before doing work and a second concurrent run skips cleanly (logs "skipped — lock held", returns 200 with `skipped: true`), so a single window cannot double-send.
5. No behavior change to cadence day values, notification content, quiet-hours logic, or the weekly-limit guardrail.

## Non-goals

- No change to `REMINDER_CADENCE_DAYS`, quiet-hours windows, or anti-spam thresholds.
- No change to `sendTenantNotification`, predicates, or notification templates.
- No new cron *schedules* and no Vercel `vercel.json` cron config changes.
- Do **not** apply any migration to prod (per BATCH-RUN-PROTOCOL).

---

## Implementation phases

### Phase 1 — #1: mandatory cron auth (the deploy blocker)
Add a shared helper, e.g. `lib/cron/auth.ts`:

```ts
export function assertCronAuthorized(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(JSON.stringify({ event: 'cron_secret_unset', path: request.nextUrl.pathname }));
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null; // authorized
}
```

In each of the three routes, replace the inline `if (secret) {…}` block with:

```ts
const denied = assertCronAuthorized(request);
if (denied) return denied;
```

Returning **401 on a missing secret** is the fail-closed default the audit calls for: a misconfigured prod (no secret set) means the cron does not run rather than running open. The structured `cron_secret_unset` error log makes the misconfiguration visible in observability rather than silent.

> Operational note for the action-items list (not a code change): `CRON_SECRET` must be set in **prod and preview** envs, and the Vercel cron invocation must send `Authorization: Bearer <CRON_SECRET>`. Confirm this is wired before relying on the cron in prod.

### Phase 2 — #9: anchor cadence to `intake_submitted_at`
Change `getNextReminderDate` to take the application's intake timestamp and compute the next reminder as `intake_submitted_at + nextCadenceDay days`:

```ts
function getNextReminderDate(reminderCount: number, intakeSubmittedAt: string): Date | null {
  const nextDay = REMINDER_CADENCE_DAYS.find(day => day > reminderCount);
  if (nextDay === undefined) return null;
  return new Date(new Date(intakeSubmittedAt).getTime() + nextDay * 24 * 60 * 60 * 1000);
}
```

Update both call sites ([lines 183, 267](app/api/cron/pbv-deferred-reminders/route.ts#L183)) to pass `app.intake_submitted_at`. `app.intake_submitted_at` is `not null` for every row the query returns (the query filters `.not('intake_submitted_at', 'is', null)`, [line 141](app/api/cron/pbv-deferred-reminders/route.ts#L141)), so the value is always present — but guard for the null case defensively and skip rescheduling if it is somehow absent. The quiet-hours reschedule (set to 9am tomorrow tenant-local, [lines 204-214](app/api/cron/pbv-deferred-reminders/route.ts#L204)) is a separate, intentional deferral and stays as-is.

### Phase 3 — #10: connection-independent run lock
First, **check for an existing cron-lock primitive** (grep for `advisory`, `cron_lock`, `pg_try_advisory`); if one exists, use it. If none exists, add a small claim table via migration `supabase/migrations/<ts>_cron_run_locks.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.cron_run_locks (
  job_name     TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cron_run_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role full access on cron_run_locks"
  ON public.cron_run_locks FOR ALL TO service_role USING (true) WITH CHECK (true);
```

Acquire with an atomic conditional upsert (a single statement, so it is safe under concurrent connections). A helper `claimCronRun(jobName, leaseSeconds)` does:

```sql
INSERT INTO cron_run_locks (job_name, locked_until)
VALUES ($1, now() + ($2 || ' seconds')::interval)
ON CONFLICT (job_name) DO UPDATE
  SET locked_until = excluded.locked_until, updated_at = now()
  WHERE cron_run_locks.locked_until < now()
RETURNING job_name;
```

If the statement returns a row, this run holds the lease; if it returns nothing, another region holds it → the handler logs `{ event: 'cron_skipped_locked', job: jobName }` and returns `200 { skipped: true }`. Release is **not required** (the lease expires); pick a `leaseSeconds` comfortably longer than the worst-case run (e.g. 600s for deferred-reminders). Implement via a `SECURITY DEFINER` RPC if a raw SQL statement is awkward through supabase-js. Apply the lock to `pbv-deferred-reminders` and `scheduled-sends` (the two that send). `cleanup-idempotency-keys` is idempotent (a delete by `expires_at`) so a double-run is harmless — the lock there is optional; default to adding it for consistency and log the choice.

**Fallback if the claim table cannot be validated in-session:** land Phases 1 and 2 (Phase 1 is the deploy blocker; Phase 2 is a pure code change), commit them, and log #10 as a **BLOCKER** in OPEN-DECISIONS with the table-claim design above as the recommended approach — do **not** ship a session-level `pg_advisory_lock` that the connection pool may not honor.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (#1 unset secret):** unit test — with `CRON_SECRET` unset, each route returns 401 and the handler body does not run.
- **Gate 2 (#1 mismatch):** unit test — with `CRON_SECRET` set and a wrong/missing Bearer header → 401.
- **Gate 3 (#1 valid):** unit test — correct `Bearer <secret>` → handler proceeds.
- **Gate 4 (#9):** unit test — `getNextReminderDate(count, intakeSubmittedAt)` returns `intakeSubmittedAt + nextDay` and is independent of wall-clock `now`.
- **Gate 5 (#10):** unit/integration test — a second `claimCronRun` for the same job within the lease window returns no row (skip); after the lease expires it succeeds.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; new tests green (`npx vitest run` for the touched files).

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** in a deployed preview, hit each cron route with no Bearer header → 401; with the correct Bearer → 200.
- **Gate R2:** apply the `cron_run_locks` migration on staging and confirm two near-simultaneous deferred-reminders invocations result in one run + one skip.

---

## Open questions

- **O1 (#10):** Does a cron-lock primitive already exist in the repo? If yes, reuse it and skip the new table. Default: add `cron_run_locks` if none found, and log the decision.
- **O2 (#1):** 401 vs 503 for an unset secret. Default to **401** (matches the audit and avoids leaking config state); a 503 "misconfigured" is also defensible — log the choice if you deviate.

## Decisions

- **D1 (#1):** Fail **closed** — unset `CRON_SECRET` → 401, centralized in `assertCronAuthorized`. No handler runs without a verified secret.
- **D2 (#9):** Cadence anchored to `intake_submitted_at`. Quiet-hours deferral logic unchanged.
- **D3 (#10):** Connection-independent claim table (`cron_run_locks`) with a lease, not a session advisory lock. Migration committed, not applied.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/cron/auth.ts` (new) | 1 | `assertCronAuthorized(request)` helper — fail-closed |
| `app/api/cron/pbv-deferred-reminders/route.ts` | 1, 2, 3 | use helper; cadence from `intake_submitted_at`; acquire run lock |
| `app/api/cron/cleanup-idempotency-keys/route.ts` | 1 | use helper (lock optional) |
| `app/api/cron/notifications/scheduled-sends/route.ts` | 1, 3 | use helper; acquire run lock |
| `supabase/migrations/<ts>_cron_run_locks.sql` (new) | 3 | claim table + `service_role` RLS — **commit only, list in OPEN-DECISIONS, do not apply** |
| `lib/cron/runLock.ts` (new, optional) | 3 | `claimCronRun(jobName, leaseSeconds)` helper |
| new test(s) | 1–3 | Gates 1–5 |

If anything outside this list needs changing, default-and-log per BATCH-RUN-PROTOCOL.
