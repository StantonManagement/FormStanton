# Build Report — PRD-85: PBV Intake→Signing Notification Reliability

**Date:** 2026-05-31
**Branch:** `main` (suggested PR branch: `feat/pbv-notification-reliability`)
**PRD:** `docs/fullApp-Plan/85-pbv-intake-signing-notification-reliability_prd_2026-05-31.md`
**Status:** Code complete. Migration written (unapplied). Phase-4 backfill left gated.

---

## Summary

Closed the two gaps that let an intake→signing handoff (`pbv_preflight_checklist` SMS)
fail silently: (1) the failed handoff is now retryable and operator-visible rather than
terminal, and (2) a migration asserts every active notification type has a template row
for each supported language. The two affected real applicants (Mia, Santha) are **not**
re-notified by this build — that backfill stays gated on PRD-86 and is an operator action.

Handoff delivery state is **event-derived** (no schema column), per the PRD Data Model
default — single source of truth in `application_events`.

---

## What changed

### Phase 1 — retryable + visible handoff

- **`app/api/t/[token]/pbv-full-app/intake/complete/route.ts`** — the preflight send now
  captures the `sendTenantNotification` result and branches on it. A non-delivered handoff
  logs a clear warning and is treated as "handoff pending" (event-derived: the
  `notification.failed` row is already emitted by the send path — we do **not** write an
  extra event, to avoid double-counting attempts). Intake completion is never blocked.

- **`lib/notifications/handoffRetry.ts`** (new) — pure, event-derived handoff logic shared
  by the cron sweep and the operator surface:
  - `deriveHandoffState(events)` → `{ sent, failedCount, firstFailedAt, lastFailedAt }`
    (only `pbv_preflight_checklist` events counted).
  - `isHandoffPending(state)` — the "intake complete / handoff not sent" signal.
  - `evaluateHandoffRetry({ now, state, intakeCompletedAt })` — retry decision with the
    attempt cap, 24h window, and backoff.

- **`app/api/cron/pbv-handoff-retry/route.ts`** (new) — cron sweep. Claims the PRD-74
  `cron_run_locks` lease (`claimCronRun('pbv-handoff-retry', 300)`), fetches intake-complete
  apps + their handoff events in batch, and re-attempts only eligible handoffs in the
  applicant's language via the same `sendTenantNotification` path (which emits the existing
  `notification.sent` / `notification.failed` events). Authorized by `assertCronAuthorized`.

- **`vercel.json`** — registered the cron at `30 * * * *` (hourly, offset from the existing
  on-the-hour jobs). Hourly cadence honors the 1h first-retry backoff.

### Phase 2 — seed-presence assertion + idempotent reseed

- **`supabase/migrations/20260531120000_prd85_notification_template_seed_assertion.sql`**
  (new, **unapplied**):
  - (a) Idempotently re-seeds `pbv_preflight_checklist` (en/es/pt) with the canonical bodies
    (`ON CONFLICT (notification_type, language, version) DO NOTHING`) so a fresh DB built
    purely from migrations always has the handoff template.
  - (b) A `DO $$ ... RAISE EXCEPTION` block that fails the migration if any `active=true`
    notification type is missing an active row for `en`/`es`/`pt`.

- **`lib/notifications/seedAssertion.ts`** (new) — TypeScript mirror of the SQL assertion
  (`findActiveTemplateLanguageGaps`, `assertTemplateLanguagesPresent`) so the rule is
  unit-testable. **Keep in lockstep with the migration.**

### Phase 3 — operator surface

- **`app/api/admin/pbv/pipeline/route.ts`** — added a batch query of `notification.sent` /
  `notification.failed` events for the listed apps and derives `handoff_pending` +
  `handoff_attempts` per row (via `deriveHandoffState` / `isHandoffPending`).

- **`app/admin/pbv/pipeline/page.tsx`** — added a red **"Handoff not sent"** badge and a
  **"Resend handoff"** button in the Tenant column (per-row loading state + toast +
  refresh), wired to the resend route.

- **`app/api/admin/pbv/applications/[id]/resend-handoff/route.ts`** (new) — Stanton-staff
  one-click resend. Rebuilds interpolations and calls the same `sendTenantNotification`
  path; audit-logged. This is also the **manual Phase-4 trigger**.

### Tests

- `lib/notifications/__tests__/handoffRetry.test.ts` (14 tests) — failed-send branch records
  pending state; sweep eligibility respects the attempt cap, the 24h window (incl. the
  Mia/Santha aged-out case), backoff, and absent-handoff bounds.
- `lib/notifications/__tests__/seedAssertion.test.ts` (6 tests) — assertion fails on a
  missing template language and passes when seeded; inactive rows don't satisfy the rule.

---

## Gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ clean |
| Unit tests | `node ./node_modules/vitest/vitest.mjs run lib/notifications/__tests__/handoffRetry.test.ts lib/notifications/__tests__/seedAssertion.test.ts` | ✅ 20/20 pass |
| Lint | `npm run lint` (`npx next lint`) | ⚠️ Not run — ESLint is not installed in this sandbox and `npx next lint` triggers an interactive install (Windows hang per `docs/SHELL-PROTOCOL.md`). Conformance verified by inspection against `next/core-web-vitals`; touched files mirror existing patterns (exhaustive hook deps, no new `any`). Run `npm run lint` in an env with ESLint installed to close this. |
| Runtime (manual Chrome walk) | out of gate | pending operator |

> Test runner note: `node ./node_modules/.bin/vitest` fails on Windows (the `.bin` shim is a
> shell script). Use the mjs entry: `node ./node_modules/vitest/vitest.mjs run <paths>`.

---

## Migration to apply (by Alex / Windsurf — NOT from this environment)

`supabase/migrations/20260531120000_prd85_notification_template_seed_assertion.sql`

Apply via Supabase MCP / `db push` per the standing DB-apply path. The assertion will
abort if prod is missing any active template language — that is the intended behavior
(fix the gap, then re-apply). Production currently has the en/es/pt rows (seeded
2026-05-29), so the assertion is expected to pass.

---

## Phase 4 — GATED backfill (do NOT run yet)

Do **not** re-notify the two affected applicants until **PRD-86** corrects the form
field-maps and their unsigned documents are regenerated — otherwise they sign the
defective-spacing version.

- Mia Enid Lozada — app `2b451d4e-6578-43e6-9689-450cadcc62fe` (language `en`)
- Santha Lee Degross — app `00d613e5-1573-4a7b-ab98-73a46ca4d681` (language `en`)

**Why the auto-sweep will not touch them:** their `notification.failed` events are from
2026-05-20→27 — older than the 24h retry window — so `evaluateHandoffRetry` returns
`window_closed`. They remain visible on the pipeline dashboard ("Handoff not sent") but
are not auto-retried.

**Operator-triggered backfill steps (after PRD-86):**
1. PRD-86 corrects field-maps; regenerate Mia's and Santha's 11 unsigned documents.
2. On the PBV pipeline dashboard, click **Resend handoff** on each row (or POST
   `/api/admin/pbv/applications/{id}/resend-handoff`).
3. Confirm `application_events` shows `notification.sent` for `pbv_preflight_checklist`
   (dated after regeneration) for both, in `en`.

---

## Decisions logged (per PRD open questions)

1. **Retry cadence / max attempts** — default adopted: **3 total attempts over a 24h
   window** (initial intake-complete send + up to 2 sweep retries), backoff 1h then 6h.
   Tunable via constants in `lib/notifications/handoffRetry.ts`
   (`HANDOFF_MAX_ATTEMPTS`, `HANDOFF_RETRY_WINDOW_HOURS`, `HANDOFF_BACKOFF_HOURS`).
2. **Event-derived vs. `handoff_status` column** — **event-derived** (PRD default). No
   schema change; `application_events` is the single source of truth. Add an indexed column
   later only if the dashboard read becomes a hotspot.
3. **Send language** — `resolveTenant` selects the template language from
   `preferred_language` (falling back to `en`); the sweep/resend build the doc list with
   `preferred_language ?? submission_language ?? 'en'` so the doc list and template agree.
   For Mia and Santha this is `en`, matching the PRD.

---

## Notes / flagged to ops (out of scope, per PRD Non-goals)

- `magic_link_initial` failed twice on 2026-05-20 with `PBV_TWILIO_PHONE_NUMBER not
  configured` — confirm the env var is set in prod (PRD open question #4). Not addressed here.
- `Claudia Ferreira` (`ffffcafe…aa02`) intake-complete/unsigned but pre-dates the preflight
  notification and emitted no `template_missing` event — triage real-vs-seed separately.
  The auto-sweep will not touch her (no failure event + old intake → outside window).

---

## Scope adherence

Touched only: `intake/complete/route.ts`, the new migration, the cron sweep, and
admin-surface additions (pipeline route + page, resend route) plus the shared
`lib/notifications/handoffRetry.ts` / `seedAssertion.ts` and their tests. No change to the
signing ceremony, token logic, document generation, or the China Wall.
`lib/notifications/send.ts` needed no change — its return contract already carries `reason`
and emits the failure event; it is listed in scope only as the allowed surface.
