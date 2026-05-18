# PRD-04: PBV Tenant Notifications (Twilio Lifecycle Integration)

**Date:** 2026-05-14
**Status:** Draft — ready for review
**Depends on:** `stanton-workspace-document-lifecycle` merged. `rejection-tenant-loop` merged (this PRD generalizes its template pattern). PRD-02 + PRD-03 merged (event types they emit drive several notification triggers).
**Coordinates with:** `post-approval-execution` — HACH approval + signing milestones emit events that trigger SMS in this PRD.
**Anchor scope:** `pbv_full_application` only.

---

## Problem Statement

Twilio is partially wired into the application but no lifecycle-level coordination exists. Current state:

- `lib/sendPortalLink.ts` sends a one-off magic-link SMS with hard-coded message bodies in three languages.
- `lib/notifications.ts` + `rejection-templates` + `tenant_notifications` table handle **document rejection** notifications specifically.
- `app/api/webhooks/twilio/route.ts` accepts Twilio delivery status callbacks.
- No initial magic-link automation tied to application creation.
- No reminders for missing documents or unsigned packets.
- No notification on HACH approval (signing ready).
- No STOP/HELP inbound handling. No TCPA-style consent capture surfaced anywhere.
- Templates are scattered: hard-coded in `sendPortalLink.ts`, table-driven in `rejection_reason_templates`. No unified registry.
- No bulk-send primitive (the project knowledge note "Twilio SMS bulk send — nearly done" has no current implementation surface).

The PBV lifecycle has ~6 distinct moments where the tenant needs an SMS. Today, one of them works (rejection), one half-works (initial link via manual call), and the rest don't exist.

PRD-04 unifies tenant SMS into a single notification system covering every PBV lifecycle event, with a template registry, consent capture, STOP/HELP compliance, and bulk-send.

---

## Goals

1. **Unified template registry** — one `tenant_notification_templates` table keyed by `(notification_type, language)`. Existing `rejection_reason_templates` migrates into it or coexists (decision in Open Questions).
2. **Lifecycle-driven sends.** Each PBV application state transition that requires tenant contact emits an `application_event` already; PRD-04 attaches a notification trigger to each. Triggers are declarative (event_type → notification_type mapping), not hard-coded per-route.
3. **Reminder scheduling.** Application-aware cron job sends reminders at defined intervals when the tenant has not acted. Scheduled via Vercel cron.
4. **TCPA compliance.** Consent captured at application creation. STOP/HELP inbound keywords handled. Consent state surfaced in admin UI.
5. **Bulk send.** Project-scoped or filter-scoped bulk send primitive for one-off campaigns (e.g., "send the magic link to every unit in this PBV cohort").
6. **Delivery tracking.** Every send writes to `tenant_notifications` with `twilio_message_sid`. Webhook updates `delivery_status`. Admin UI surfaces failed sends.
7. **All event writes via `writePbvApplicationEvent`.** New event types added to `ApplicationEventType`.
8. **Every code claim in the build report is backed by a grep command + raw output.**

## Non-Goals

- **No voice calls.** SMS only.
- **No marketing / promotional messages.** Only transactional, lifecycle-driven.
- **No two-way conversational threading.** Inbound is limited to STOP / HELP / START keywords + delivery callbacks.
- **No email integration.** Email is handled by Resend in `sendPortalLink.ts` and stays as-is. PRD-04 covers SMS only. Email parity is a later PRD if needed.
- **No A/B-testing infrastructure for message bodies.** Single canonical template per `(notification_type, language)`.
- **No tenant-initiated outbound.** Tenants do not request SMS via the portal in this PRD.
- **No multi-recipient per send.** One application → one tenant phone per send. Bulk send fans out one-per-tenant under the hood.

---

## Users & Roles

| Role | What they do here |
|---|---|
| Stanton admin | Sees delivery status per application. Triggers bulk send. Edits templates (Phase 2 — admin UI optional in v1). |
| Tenant | Receives SMS. Can reply STOP / HELP / START to control consent. No portal interaction with this PRD. |
| System / cron | Runs reminder scheduler. |

No new permission introduced. Bulk send gated by an existing admin permission (Open Question 2 confirms which).

---

## Closed Decisions

1. **Provider:** Twilio. Already wired. Reuse existing client.
2. **Languages:** EN / ES / PT — same set as portal.
3. **Event substrate:** All event writes via `writePbvApplicationEvent`. Never call `writeApplicationEvent` directly. Never insert into `application_events` outside `lib/events/application-events.ts`.
4. **New event types:**
   - `NOTIFICATION_SCHEDULED: 'notification.scheduled'`
   - `NOTIFICATION_SENT: 'notification.sent'`
   - `NOTIFICATION_FAILED: 'notification.failed'`
   - `NOTIFICATION_OPTED_OUT: 'notification.opted_out'`
5. **Template registry:** New table `tenant_notification_templates`. Existing `rejection_reason_templates` continues to exist; rejection notifications keep their dedicated route but read from the new unified table on read. (Open Question 1 confirms exact migration approach.)
6. **Trigger model:** Declarative mapping `application_event.event_type → notification_type` defined in `lib/notifications/triggers.ts`. No hard-coded SMS-send calls from route handlers. Routes write events; the events trigger notifications via a hook.
7. **Reminder scheduling:** Vercel cron, hourly. `notification_schedules` table holds future sends; cron picks up due rows.
8. **Consent capture:** A consent column on `pbv_full_applications` (`sms_consent_captured_at`, `sms_consent_text_version`). Captured at application creation by the existing portal — PRD-04 adds the column and the read path; the portal already collects consent text but doesn't persist it structurally.
9. **STOP/HELP handling:** Inbound webhook at `/api/webhooks/twilio/inbound`. Keyword detection (case-insensitive). STOP → set `sms_opted_out_at` on `pbv_full_applications`, no further SMS to that number. HELP → respond with help message in tenant's language. START → clear opt-out.
10. **Evidence standard:** Every code-claim in the build report is backed by a grep command + raw output.

---

## Open Questions for Windsurf

Confirm before coding the affected phase. Post answer in build report. Do not assume.

1. **Rejection template migration.** Confirm whether `rejection_reason_templates` should remain its own table (read by both `lib/notifications.ts` and the new unified path) or be folded into `tenant_notification_templates`. Recommend keeping both: the rejection table holds the reason vocabulary (code + label + reason-specific copy), the unified table holds the wrapper template. Post the decision and the column reconciliation.
2. **Bulk-send permission.** Confirm the existing admin permission that gates project-scoped bulk operations (likely `pbv-full-applications:send_to_hach` or `projects:bulk_send` — check `permissions` table). Post the grep + table query.
3. **Phone number storage location.** Partial answer from cross-PRD audit: `pbv_full_applications.phone` is selected in `app/api/t/[token]/pbv-full-app/route.ts:26-31` alongside `preferred_language`. Treat this as the primary source. Confirm whether `form_submissions.phone` is a secondary source (older path) and whether a backfill is needed for applications missing `pbv_full_applications.phone`. Post grep + sample row.
4. **Cron schedule registration.** Confirm Vercel cron configuration file (`vercel.json` or `app/api/cron/*`). PRD-04 registers an hourly cron at `/api/cron/notifications/scheduled-sends`.

---

## Core Features

### 1. Notification type catalog

Defined in `lib/notifications/types.ts` as a const enum. Each type maps to:
- A trigger condition (event type OR cron rule).
- A template family in `tenant_notification_templates`.
- A reminder cadence (if applicable).
- A consent requirement (opted-out tenants do not receive this type — true for all except `system_emergency`, which is reserved and not used in v1).

| `notification_type` | Trigger | Reminder cadence | Notes |
|---|---|---|---|
| `magic_link_initial` | `pbv_full_application.created` (new event type — see Phase 1) | — | First SMS. Sent immediately on application creation. |
| `magic_link_resent` | Admin-triggered (UI button + bulk send) | — | Same body, different `notification_type` for tracking. |
| `docs_upload_reminder` | Cron: 3 days, 7 days, 14 days after application created if `uploaded_count < required_count` | Auto until docs uploaded OR opt-out | Stops if tenant uploads everything. |
| `doc_rejected` | `document.rejected` event | — | Owned by existing `rejection-tenant-loop` flow. PRD-04 wraps it under the unified send path. |
| `hach_approved_signing_ready` | `handoff.sent` event with payload status flipping to `approved_by_hach` (via HACH portal route) | — | Notifies tenant signing packet is ready. |
| `signing_reminder` | Cron: 2 days after signing-packet ready if any signature still missing | Up to 3 reminders | Stops when packet fully signed. |
| `hap_executed_move_in` | `hap_executed` event | — | Final notification. Welcome / move-in instructions. |

### 2. Template registry

New table `tenant_notification_templates`:

| Column | Type | Notes |
|---|---|---|
| `notification_type` | text | NOT NULL. From the catalog above. |
| `language` | text | NOT NULL. CHECK in (`'en'`, `'es'`, `'pt'`). |
| `body` | text | NOT NULL. Supports `{interpolation}` slots. |
| `version` | integer | NOT NULL DEFAULT 1. Incremented when staff edits. |
| `active` | boolean | NOT NULL DEFAULT true. |
| `created_at` | timestamptz | DEFAULT now() |
| `updated_at` | timestamptz | DEFAULT now() |

PRIMARY KEY: `(notification_type, language, version)`.
UNIQUE INDEX: `(notification_type, language) WHERE active = true` — exactly one active template per type+language.

Seeded with EN/ES/PT for every notification type in §1.

Interpolation slots supported: `{tenant_name}`, `{portal_url}`, `{doc_label}`, `{custom_note}`, `{deadline_date}`. Renderer in `lib/notifications/render.ts` — single function, missing-slot behavior: leave the literal `{slot}` in place and log a warning (do not throw — sending a degraded message beats blocking the lifecycle).

### 3. Send primitive

`lib/notifications/send.ts` exports:

```
sendTenantNotification({
  applicationId: string;
  notificationType: NotificationType;
  interpolations: Record<string, string>;
  triggeredByEventId?: string;  // application_events.id for traceability
}): Promise<SendResult>
```

Action sequence inside the primitive:
1. Resolve tenant phone + language from `pbv_full_applications` (or upstream tables — Open Question 3).
2. Check `sms_opted_out_at` — if set, return `{ status: 'blocked', reason: 'opted_out' }` and emit `notification.opted_out` event. No Twilio call.
3. Fetch active template for `(notification_type, language)`. If missing, log + emit `notification.failed` with reason `'template_missing'`.
4. Render template with interpolations.
5. Insert `tenant_notifications` row with `delivery_status='pending'`.
6. Call Twilio. On success, update row with `twilio_message_sid` + `delivery_status='queued'`. Emit `notification.sent`.
7. On Twilio failure, update row to `delivery_status='failed'` with error. Emit `notification.failed`.

All event emissions via `writePbvApplicationEvent`.

### 4. Trigger model

`lib/notifications/triggers.ts` maps event types to notification types:

```
const eventToNotification: Record<string, NotificationType | null> = {
  'pbv_full_application.created': 'magic_link_initial',
  'document.rejected': 'doc_rejected',
  'handoff.sent': null,  // not directly — needs predicate on payload.hach_review_status
  'hap_executed': 'hap_executed_move_in',
  // ...
};
```

A subscriber hook in the event write path (`lib/events/application-events.ts` extension) calls the trigger lookup after every event write and dispatches to `sendTenantNotification` if a mapping exists. The hook is **fire-and-forget after the original tx commits** — notification failures never block the lifecycle event.

### 5. Reminder cron

Endpoint `/api/cron/notifications/scheduled-sends`:
- Reads `notification_schedules` rows where `due_at <= now()` and `status = 'pending'`.
- For each: calls `sendTenantNotification` with the stored type + interpolations.
- Marks the row `status = 'sent'` or `'cancelled'` (if the original condition no longer holds — e.g., tenant already uploaded all docs).

`notification_schedules` table:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `application_id` | uuid | NOT NULL |
| `notification_type` | text | NOT NULL |
| `due_at` | timestamptz | NOT NULL |
| `cancel_predicate` | text | nullable. Names a function in `lib/notifications/predicates.ts` (e.g., `'all_docs_uploaded'`) that, if true, cancels the send. |
| `status` | text | `'pending'`, `'sent'`, `'cancelled'`, `'failed'` |
| `interpolations` | jsonb | snapshot taken at scheduling time |
| `created_at` | timestamptz | DEFAULT now() |
| `sent_at` | timestamptz | nullable |

Scheduled rows inserted by the same trigger subscriber when an event implies future reminders (e.g., `pbv_full_application.created` schedules three `docs_upload_reminder` rows at +3d, +7d, +14d).

### 6. STOP / HELP / START inbound

New route `/api/webhooks/twilio/inbound/route.ts`:
- Validates Twilio signature.
- Parses `Body` field, case-insensitive keyword match.
- STOP → sets `pbv_full_applications.sms_opted_out_at = now()` for every application matching the phone number. Emits `notification.opted_out` per matched application. Sends auto-reply confirming opt-out in EN (Twilio carrier requirement).
- HELP → sends auto-reply in EN with help text + Stanton contact info. No state change.
- START → clears `sms_opted_out_at`. Sends auto-reply confirming re-subscription. Emits `notification.opted_out` with payload `{ action: 'rescinded' }`.
- Any other inbound: logs to `tenant_inbound_messages` table for admin visibility. No auto-reply.

### 7. Bulk send

`POST /api/admin/notifications/bulk-send`:
- Authenticated, permission-gated (Open Question 2).
- Request body: `{ notification_type, filter: { project_id? | application_ids? | application_status? }, dry_run?: boolean }`.
- Resolves matching applications, fans out one `sendTenantNotification` per application.
- Dry-run returns the resolved application list + opt-out summary without sending.
- Wet-run emits a single `bulk_send_initiated` event with a `bulk_send_id` UUID; individual sends reference this ID in their event payloads for grouping.

### 8. Admin visibility

Extend an existing admin surface (probably the application detail page or a dedicated dashboard panel) with:
- Per-application notification timeline (reads `tenant_notifications` for that application).
- Opt-out badge if `sms_opted_out_at` is set.
- "Resend magic link" button (calls `magic_link_resent`).
- Failed-send count + a click-through list (admin-wide view).

Specific UI placement deferred to Windsurf's discretion — must not break the existing review surface ergonomics. Document the choice in build report.

---

## Data Model

### New tables

- `tenant_notification_templates` — schema above.
- `notification_schedules` — schema above.
- `tenant_inbound_messages` — schema:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `from_phone` | text | NOT NULL |
| `body` | text | NOT NULL |
| `received_at` | timestamptz | DEFAULT now() |
| `twilio_message_sid` | text | UNIQUE |
| `matched_keyword` | text | nullable. `'STOP'`, `'HELP'`, `'START'`, or null. |
| `handled` | boolean | NOT NULL DEFAULT false. Manual admin flag. |

### Modified tables

- `pbv_full_applications`: ADD `sms_consent_captured_at TIMESTAMPTZ NULL`, `sms_consent_text_version TEXT NULL`, `sms_opted_out_at TIMESTAMPTZ NULL`.
- `tenant_notifications` (already exists from `rejection-tenant-loop`): no schema change. Confirm `notification_type` accepts the new values from §1.

### New event types

In `lib/events/application-events.ts`:
- `NOTIFICATION_SCHEDULED: 'notification.scheduled'`
- `NOTIFICATION_SENT: 'notification.sent'`
- `NOTIFICATION_FAILED: 'notification.failed'`
- `NOTIFICATION_OPTED_OUT: 'notification.opted_out'`

Plus a precursor event for triggering the initial magic-link send:
- `APPLICATION_CREATED: 'pbv_full_application.created'` — emitted when a new `pbv_full_applications` row is inserted. Anchor type same as application anchor.

(If `APPLICATION_CREATED` already exists somewhere, confirm and reuse — see Phase 1.)

---

## Integration Points

- `lib/events/application-events.ts`: new event types + a `subscribe()` mechanism that the trigger model hooks into.
- `lib/sendPortalLink.ts`: deprecated or rewritten to call `sendTenantNotification({ notificationType: 'magic_link_initial' })`. Confirm callers and update.
- `lib/notifications.ts` (rejection path): refactored to call `sendTenantNotification({ notificationType: 'doc_rejected', interpolations })` instead of the inline rejection path. The `rejection_reason_templates` table is still consulted for reason-specific copy; the unified template wraps it.
- `app/api/webhooks/twilio/route.ts` (delivery callbacks): no change.
- Schema-contract test extended for the three new tables + event types.
- Save-path integration test extended for: every new event type, the opt-out path, the template-missing path, the dry-run bulk send path.

---

## Implementation Phases

Five phases. Each its own merge gate.

### Phase 1 — Schema + event types + consent capture

**Build:**
- Migration `supabase/migrations/<ts>_tenant_notifications_unified.sql`:
  - `tenant_notification_templates` + `notification_schedules` + `tenant_inbound_messages` tables.
  - `pbv_full_applications` columns: `sms_consent_captured_at`, `sms_consent_text_version`, `sms_opted_out_at`.
  - Seed `tenant_notification_templates` with EN/ES/PT for every type in §1.
- Event type additions in `lib/events/application-events.ts` + payload types.
- Persist consent in the existing application-creation path: if the portal form was submitted, set `sms_consent_captured_at = now()` and `sms_consent_text_version = '2026-05-14-v1'`. Confirm the existing creation path in Open Question 3.

**Done when:**
- Migration applies clean. `\d` output for all three new tables + the new columns.
- Template count per language = number of notification types in §1.
- `grep -n "NOTIFICATION_SENT\|NOTIFICATION_FAILED\|NOTIFICATION_SCHEDULED\|NOTIFICATION_OPTED_OUT" lib/events/application-events.ts` returns the definitions.

### Phase 2 — Send primitive + render + opt-out gate

**Build:**
- `lib/notifications/render.ts` + `lib/notifications/send.ts` + `lib/notifications/types.ts`.
- Opt-out gate: send primitive checks `sms_opted_out_at` and returns blocked without calling Twilio.
- Refactor `lib/sendPortalLink.ts` to call the new primitive for `magic_link_initial`. Keep the old function signature as a thin shim during transition.
- Refactor `lib/notifications.ts` (rejection) to call the new primitive for `doc_rejected`. Confirm rejection-reason interpolation still works.

**Done when:**
- Happy send: unit test fires `sendTenantNotification` against a real Twilio sandbox (or a mocked client with assertions on the outbound call). Raw output.
- Opted-out: send returns blocked, no Twilio call. Raw assertion.
- Template-missing: send returns failed with reason, no Twilio call. Raw assertion.
- `grep -rn "twilioClient.messages.create" lib app` returns exactly one call site (inside `lib/notifications/send.ts`). All other Twilio-send paths route through the primitive.

### Phase 3 — Trigger model + scheduler

**Build:**
- `lib/notifications/triggers.ts` with the event-type mapping.
- Hook in `writePbvApplicationEvent` (or a new event-bus indirection) that calls the trigger after the event write commits.
- Reminder scheduling logic: on `APPLICATION_CREATED`, insert three `notification_schedules` rows.
- Cron endpoint `app/api/cron/notifications/scheduled-sends/route.ts`. Reads due rows, calls send primitive, updates statuses.
- `cancel_predicate` resolver (`lib/notifications/predicates.ts`) with the `all_docs_uploaded` predicate.

**Done when:**
- Creating a new application emits `APPLICATION_CREATED`, the trigger fires, `magic_link_initial` is sent, three reminders are scheduled. Raw SQL of `notification_schedules` posted.
- Cron run picks up a due reminder and dispatches. Manual invocation tested.
- `cancel_predicate` correctly cancels a `docs_upload_reminder` after all docs uploaded.

### Phase 4 — Inbound webhook + bulk send

**Build:**
- `/api/webhooks/twilio/inbound/route.ts` with signature validation + STOP/HELP/START handling.
- `/api/admin/notifications/bulk-send/route.ts` with dry-run + wet-run.

**Done when:**
- STOP inbound sets `sms_opted_out_at` on all matched applications. Raw evidence.
- HELP inbound responds with help message. Raw curl output.
- Bulk send dry-run returns the resolved list + opt-out summary. No Twilio calls. Raw evidence.
- Bulk send wet-run fans out N sends, each tagged with the bulk_send_id. Raw evidence.

### Phase 5 — Admin visibility + verification

**Build:**
- Per-application notification timeline component or section on the existing application detail page.
- Opt-out badge + "Resend magic link" button.
- Failed-send admin list (dashboard panel or dedicated route).
- Save-path integration tests for all paths in §3 of "Integration Points."

**Done when:**
- All save-path cases pass.
- `npm test` zero failures.
- `npm run build` zero errors.
- Admin can see notification timeline on a test application. Screenshot.
- All grep audits re-run and posted in verification section. Raw outputs.

---

## Architecture Rules (binding)

- **All event writes go through `writePbvApplicationEvent`.** Direct calls to `writeApplicationEvent` from a route are forbidden. Direct inserts into `application_events` outside `lib/events/application-events.ts` are forbidden.
- **All Twilio SMS sends go through `sendTenantNotification`.** Direct calls to `twilioClient.messages.create` outside `lib/notifications/send.ts` are forbidden.
- **Opt-out gate is non-bypassable.** Any code path that constructs an SMS must call `sendTenantNotification`, which checks consent.
- **Notification failures never block the originating lifecycle event.** Send happens after the event tx commits; failures emit `notification.failed` and surface in admin, they do not roll back state.
- **Template-missing degrades gracefully.** Renderer leaves literal `{slot}` in place, logs a warning, sends the partial message. Never throws.
- **No direct schema reads outside the resolver.** Phone + language resolution happens in `lib/notifications/resolve.ts`. Send primitive does not query `pbv_full_applications` directly for these fields.

---

## Verification Gates (mirror PRD-01/02/03)

1. Migrations apply clean. `\d` for all new tables + new columns posted.
2. Schema-contract test green.
3. `npm run build` zero errors.
4. TypeScript strict — no new `any`.
5. `npm test` green.
6. Send happy path: creating an application triggers `magic_link_initial`, Twilio call observed (sandbox or mocked), `tenant_notifications` row written, `notification.sent` event emitted. Raw output.
7. Opt-out path: STOP inbound flips opt-out; subsequent send returns blocked with no Twilio call. Raw output.
8. Reminder cron: schedule rows inserted, cron processes due rows, cancellation predicate works. Raw SQL + curl.
9. Rejection path still works: rejecting a document triggers `doc_rejected` via the unified path; existing `rejection-templates` interpolation still produces correct copy. Raw output.
10. Bulk send dry-run resolves the application list and opt-out summary. Raw output.
11. Grep audits posted with raw command + output:
    - `twilioClient.messages.create` call sites = 1 (in `lib/notifications/send.ts`).
    - `writeApplicationEvent` direct calls in `app/api` and `lib/notifications` = 0.
    - `INSERT INTO application_events` outside `lib/events/application-events.ts` = 0.
    - `tenant_notification_templates` callers = 1 (the renderer).
12. Build report sections fully populated, including answers to all four Open Questions.

If any of 1–12 fails: **stop. Report. Do not declare complete.**

---

## Out of Scope (to be later PRDs)

- Voice calls / IVR.
- Email parity for these lifecycle events (email currently only via `sendPortalLink.ts`).
- Tenant-initiated outbound (request-by-portal).
- Multi-recipient per send (e