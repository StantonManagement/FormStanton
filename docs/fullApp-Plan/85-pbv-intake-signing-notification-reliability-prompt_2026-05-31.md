# Build Prompt — PRD-85 (PBV Intake→Signing Notification Reliability)

You are implementing **PRD-85**. Read it in full before writing code:
`docs/fullApp-Plan/85-pbv-intake-signing-notification-reliability_prd_2026-05-31.md`

Follow `docs/SHELL-PROTOCOL.md` for all shell/typecheck commands. Use `node ./node_modules/typescript/bin/tsc --noEmit` for typechecking — never `npx tsc`.

## Scope guard (do not touch anything else)
- `lib/notifications/send.ts`
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- One new migration file under the repo's migrations dir (write only — do NOT apply to prod from this environment; Alex applies via Supabase MCP / `db push`)
- Cron sweep + admin-surface additions per the PRD phases

Do not change the signing ceremony, token logic, document generation, or the China Wall.

## What to build (per PRD-85 phases)
1. **Phase 1 — retryable + visible handoff.** At `intake/complete/route.ts:96-98`, branch on the `sendTenantNotification` result. On a `failed` result (e.g. `reason: 'template_missing'`), record the application as "handoff pending" (derive from `application_events` — `notification.sent` vs `notification.failed` for `pbv_preflight_checklist`; do NOT add a column unless the admin read needs an index). Do not block intake completion on the send. Add a cron sweep reusing the existing `cron_run_locks` lease pattern (PRD-74) that re-attempts pending handoffs in the applicant's `submission_language`, bounded to 3 attempts over 24h with backoff, emitting the existing events on each attempt.
2. **Phase 2 — seed-presence assertion + idempotent reseed.** Write a migration that (a) idempotently upserts `pbv_preflight_checklist` (and any other live-trigger) templates for `en`/`es`/`pt`, and (b) asserts every `active=true` notification type has a row for each supported language, failing loudly otherwise. Write the file only.
3. **Phase 3 — operator surface.** On the Stanton pipeline dashboard, add an "intake complete / handoff not sent" indicator + one-click resend that calls the same send path, reading state from `application_events`.
4. **Phase 4 — backfill is GATED.** Do NOT re-notify Mia (`2b451d4e-6578-43e6-9689-450cadcc62fe`) or Santha (`00d613e5-1573-4a7b-ab98-73a46ca4d681`) in this build. Their resend depends on PRD-86 correcting the form field-maps and regenerating their unsigned docs first. Leave Phase 4 as a documented, operator-triggered step.

## Gates (static only — no Playwright/e2e in the gate)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean
- Lint clean on touched files
- Unit tests for: failed-send branch records pending state; sweep re-sends only eligible apps and respects attempt cap; migration assertion fails on a missing template language and passes when seeded
- Runtime check is a manual Chrome walk (out of gate)

## Deliverables
- Code changes within the scope guard
- The migration file (unapplied)
- A build report at `docs/build-reports/85-pbv-intake-signing-notification-reliability_build-report_2026-05-31.md` noting what changed, the migration to apply, and the gated Phase-4 backfill steps.

## Decisions to confirm in the build report (don't block on them)
- Retry cadence/max attempts (default 3 / 24h)
- Event-derived handoff state vs. a `handoff_status` column (default: event-derived)
