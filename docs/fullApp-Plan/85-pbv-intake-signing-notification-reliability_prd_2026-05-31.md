# PRD-85 — PBV Intake→Signing Notification Reliability & Affected-Applicant Backfill

**Date:** 2026-05-31
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-notification-reliability` (suggested)
**Status:** Draft — ready for build
**Severity:** P1. Real applicants completed intake and were never prompted to sign; their applications stalled silently with no operator-visible error.
**Source:** Live production investigation, project `lieeeqqvshobnqofcdac` (Tenant Communication), 2026-05-31. Triggered by "why didn't Mia Lozada sign her documents."
**Scope guard:** `lib/notifications/send.ts`, `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`, one new migration (seed-presence assertion + idempotent reseed), and a one-time operational backfill. No change to the signing flow, the field-generation pipeline, or the China Wall. Independent of PRD-86.

---

## Problem Statement

When a tenant completes PBV intake, the system sends a `pbv_preflight_checklist` SMS — the handoff that tells the applicant their forms are ready and links them into signing. **That notification failed silently for every applicant who completed intake before 2026-05-29 02:23 UTC**, because the notification template rows did not exist in production until that timestamp.

**Confirmed in code and data (not inference):**

- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:96-98` calls `sendTenantNotification({ notificationType: NotificationType.PBV_PREFLIGHT_CHECKLIST, ... })` on intake completion.
- `lib/notifications/send.ts:76-103` fetches the active template by `(notification_type, language, active=true)`. On a miss it writes a `failed` row, logs `[notifications/send] template missing`, emits `NOTIFICATION_FAILED` with `reason: 'template_missing'`, and returns `{ status: 'failed', reason: 'template_missing' }`. **There is no throw, no retry, and no re-queue.** The caller does not surface the failure to the operator.
- `tenant_notification_templates` rows for `pbv_preflight_checklist` (en/es/pt) have `created_at = 2026-05-29 02:23:09 UTC`. Before that, the lookup returned zero rows.
- `application_events` holds 8 `notification.failed` events with `reason=template_missing, notification_type=pbv_preflight_checklist`, spanning 2026-05-20 → 2026-05-27.

**Impact (verified against production):**

| Applicant | App ID | Intake completed | Forms generated | Signed | Status |
|---|---|---|---|---|---|
| Mia Enid Lozada | `2b451d4e…62fe` | 2026-05-27 11:34 | 11 / 11 | 0 | Stalled — never prompted |
| Santha Lee Degross | `00d613e5…a681` | 2026-05-26 14:03 | 11 / 11 | 0 | Stalled — never prompted |

The other six `template_missing` apps were QA/walk-test accounts (`Ddbsj`, `QA Test Applicant`, `QA Walk Tester`, `Final/Verify Walk Tester`, `Prod Smoke Tester`); the three "walk/smoke tester" accounts signed anyway because the operator held the link directly. **Mia and Santha are the only real, intake-complete, unsigned applicants caught by this failure.**

> Note: `Claudia Ferreira` (`ffffcafe…aa02`) is also intake-complete / unsigned, but pre-dates the preflight notification entirely (`created_by=system`, 2026-04-20) and did **not** emit a `template_missing` event. [Unverified] whether she is a real applicant or seed data — triage separately, out of scope for this PRD.

A related, separate config failure exists in the same event log: `magic_link_initial` failed twice on 2026-05-20 with `reason: "PBV_TWILIO_PHONE_NUMBER not configured"`. Called out under Non-goals; flag for ops confirmation.

---

## Root cause / findings (confirm current code state before editing)

The send path treats a missing template as a terminal, swallowed failure. A notification template is operational data that can be absent in a fresh or partially-seeded environment, but the intake→signing handoff depends on it. Two independent gaps compound:

1. **No seed-presence assertion.** Nothing asserts that the templates a live trigger depends on actually exist, so a missing row surfaces only as a per-applicant runtime miss.
2. **No retry and no operator signal.** A `template_missing` result is logged and emitted as an event, but the applicant is not re-notified when the template later appears, and no operator-facing surface flags "this applicant completed intake but the handoff did not send."

This PRD closes both gaps so a missing or late-seeded template no longer silently drops the handoff, and backfills the two affected real applicants.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Preflight send call | `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:96-98` | Fires `PBV_PREFLIGHT_CHECKLIST`; return value not acted on |
| Template lookup + swallow | `lib/notifications/send.ts:76-103` | Miss → `failed` row + `NOTIFICATION_FAILED` event + return; no retry |
| Template rows | `tenant_notification_templates` | en/es/pt present, `active=true`, seeded 2026-05-29 02:23 UTC |
| Failure log | `application_events` | 8 × `template_missing` for `pbv_preflight_checklist` (5/20–5/27) |
| Affected real applicants | `pbv_full_applications` | Mia `2b451d4e…`, Santha `00d613e5…` — intake complete, 0 signed, valid `tenant_access_token` |

---

## Users & Roles

- **Tenant / applicant** — completes intake; must receive the signing handoff reliably, in their language.
- **Stanton staff (Tess, Kristine, Dan, Alex)** — need an operator-visible signal when a handoff does not send, and a one-click resend, rather than discovering stalls by accident.
- **System (cron / send pipeline)** — owns retry of a transient/late-template miss.
- HACH has no role here (pre-submission, Stanton-internal).

---

## Goals

1. A `template_missing` (or otherwise failed) preflight handoff is **retryable and operator-visible**, not silently terminal. When the template exists, the applicant is re-notified without manual DB work.
2. A startup/migration **seed-presence assertion** flags any `active` notification type that has no template row for a supported language, so a missing handoff template is caught before an applicant hits it.
3. **One-time backfill:** Mia and Santha are re-notified with a working `pbv_preflight_checklist` in their submission language — **after** PRD-86 corrects the form field-maps (see Sequencing), so they sign clean forms.
4. No change to signing logic, token validity, or the generated documents themselves.

## Non-goals

- No change to the signing ceremony, token TTL, or document generation.
- No fix here for the `PBV_TWILIO_PHONE_NUMBER not configured` `magic_link_initial` failure — call it out to ops; track separately if it recurs.
- No triage of `Claudia Ferreira` — separate question of real-vs-seed.
- No migration applied to prod from the sandbox — write the migration file; Alex/Windsurf applies via Supabase MCP / `db push` (per standing DB-apply path).

---

## Sequencing dependency (important)

**Do not re-notify Mia and Santha until PRD-86 has corrected the form field-maps and the package has been reviewed in PRD-87.** Their 11 documents are already generated from the current (defective-spacing) templates. If they are prompted now they will sign the defective version. Order: **PRD-86 Phase A** corrects field-maps → regenerate Mia's and Santha's unsigned documents → **PRD-87** operator reviews each rendered package in the pre-send UI and approves → **then** the PRD-85 backfill resend fires. The retry/observability code changes in this PRD are independent and can land first. Note: PRD-87 also gates the `pbv_preflight_checklist` send behind an operator approval — land the two send-path changes in agreed order (they are composable: no approval blocks the send, a missing template is retried).

---

## Data Model

No schema change required for core behavior. Two optional, low-risk additions for observability (decide in build):

- A nullable `last_handoff_attempt_at` / `handoff_status` on `pbv_full_applications`, OR derive handoff state from existing `application_events` (`notification.sent` vs `notification.failed` for `pbv_preflight_checklist`). **Default: derive from events** — no migration, single source of truth. Add a column only if the admin surface needs an indexed read.
- Migration adds an **idempotent reseed + presence assertion** for notification templates (see Phase 2). No new table.

---

## Integration Points

- `lib/notifications/send.ts` — return-value contract already includes `reason`; caller and retry job consume it.
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — act on a failed send (enqueue retry / mark for operator).
- Existing cron infrastructure (`cron_run_locks`, lease-based per PRD-74) — host the retry sweep.
- Admin pipeline dashboard (PRD-12 lineage) — surface "intake complete, handoff not sent."
- `tenant_notification_templates` — assertion target.

---

## Implementation phases

### Phase 1 — Make a failed handoff retryable and visible
- At `intake/complete/route.ts:96-98`, branch on the `sendTenantNotification` result. On `failed`, record the application as "handoff pending" (event-derived per Data Model) so it is eligible for retry and shows on the operator surface. Do not block intake completion on the send.
- Add a small cron sweep (reuse `cron_run_locks`) that finds applications with intake complete + latest preflight handoff `failed`/absent and re-attempts the send, in the applicant's `submission_language`, with a bounded attempt count and backoff. Each attempt emits the existing `notification.sent` / `notification.failed` events.

### Phase 2 — Seed-presence assertion + idempotent reseed
- Migration that (a) upserts the `pbv_preflight_checklist` (and any other live-trigger) templates idempotently so a fresh DB built purely from migrations has them, and (b) asserts every `active=true` notification type has a row for each supported language (`en`,`es`,`pt`), failing loudly if not. Write the file only; Alex/Windsurf applies.

### Phase 3 — Operator surface
- On the Stanton pipeline dashboard, add an "intake complete / handoff not sent" indicator and a one-click resend that calls the same send path. Read state from `application_events`.

### Phase 4 — One-time backfill (gated on PRD-86 + PRD-87)
- After PRD-86 Phase A corrects field-maps and Mia's + Santha's unsigned documents are regenerated, **and the operator has reviewed and approved each package in the PRD-87 pre-send UI**, trigger `pbv_preflight_checklist` for both via the operator resend (Phase 3) or the retry sweep (Phase 1). Confirm `notification.sent` lands and that each receives the link in their `submission_language` (`en` for both, per intake snapshot).

---

## Acceptance / verification

- Simulate a missing template in a non-prod branch: intake completion records a pending handoff, the retry sweep re-sends once the template exists, and the operator surface shows the pending state until it sends. (No assertion that delivery is guaranteed — Twilio delivery is outside this boundary; the boundary is that the system attempts and reports, rather than swallowing.)
- Migration assertion fails on a DB missing any `active` template language; passes once seeded.
- Post-backfill: `application_events` shows `notification.sent` for `pbv_preflight_checklist` for both Mia and Santha, dated after PRD-86 regeneration.
- [Inference] Re-notified applicants will then be able to reach signing via their existing valid `tenant_access_token`; applicant action to actually sign is outside system control and is not asserted here.

---

## Open questions / decisions to log

1. Retry cadence and max attempts for the handoff sweep (proposal: 3 attempts over 24h, then operator-only).
2. Whether to add the `handoff_status` column or stay event-derived (default: event-derived).
3. Triage owner for `Claudia Ferreira` (real vs seed) — not blocking.
4. Ops confirmation that `PBV_TWILIO_PHONE_NUMBER` is now configured in prod.
