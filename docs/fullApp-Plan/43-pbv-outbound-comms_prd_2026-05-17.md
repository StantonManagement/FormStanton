# PRD-43 — Tenant Outbound Comms: Pre-flight Checklist + Deferred-Doc Reminders

**Date:** 2026-05-17
**Author:** Claude (from `prd-43-brief_outbound-comms.md`)
**Branch:** `feat/pbv-outbound-comms-43`
**Status:** Shipped — 2026-05-17. Ships **before** PRD-42. Independent of card stack.
**Source brief:** `local:uploads/prd-43-brief_outbound-comms.md`

---

## Why this ships first

PRD-42 (card stack) is the headline redesign. PRD-43 is the multiplier. Two reasons it ships ahead:

1. **It works against today's directory-style `/documents` page.** No dependency on PRD-42's card stack landing.
2. **Lower risk, smaller scope.** Twilio + Resend infra is already wired (`lib/notifications/send.ts`, the existing `pbv-04-tenant-notifications` PRD shipped 2026-05-14). PRD-43 layers two new notification types on top — no new client setup, no new template pattern, no new opt-out flow.

If Tenant 1 lands before PRD-42 ships, PRD-43 alone moves the needle: tenants know what to gather before they open the link, and deferred docs get nudged instead of going stale.

---

## Problem Statement

Two gaps in the tenant comms loop:

1. **No pre-flight prep.** Tenants open the magic link with no idea what they'll need. The page is the first time they learn "you need 4 paystubs and a bank statement." For a tenant in 5-minute mobile bursts, session 1 is wasted figuring out the list instead of uploading anything.

2. **No follow-up on deferred or stalled docs.** If a tenant taps "I'll get this later" (PRD-42 — affordance not live yet) or simply abandons mid-flow, nothing nudges them back. Applications sit stale until staff manually chase. The existing `docs_upload_reminder` notification type is registered in the templates table but has no automated trigger.

Two SMS flows close both gaps. Same Twilio infra, same opt-out gate, same template pattern.

---

## Users & Roles

- **Tenants completing their PBV application** — primary recipient of both SMS flows. EN/ES/PT per `preferred_language`.
- **Stanton staff** — secondary. Fewer "what do I need to upload?" support calls. Cleaner audit trail via `application_events` (`REMINDER_SENT` events).
- **No admin UI changes in this PRD.** Staff-initiated manual nudges are explicitly out of scope.

---

## Closed decisions

- **Reuse the existing notifications infrastructure.** `sendTenantNotification()` is the only path. PRD-43 does not introduce a parallel send path.
- **Templates live in `tenant_notification_templates`.** Matches existing pattern. Versioned, EN/ES/PT, active flag, primary key `(notification_type, language, version)`.
- **Opt-out gate is non-bypassable.** Inherited from existing infra. PRD-43 does not override.
- **Idempotency via `triggeredByEventId`.** Inherited. Replays of `intake/complete` do NOT double-send pre-flight SMS.
- **Email fallback for missing phone.** Inherited from existing infra (Resend). Pre-flight and deferred reminders both fall back to email if SMS is blocked.
- **Anti-spam guardrails applied at the new-type level, not in shared infra.** Cap, quiet hours, "already engaged" pause logic added in this PRD's send path, gated on notification type so existing types (signing reminders, doc-rejected) don't change behavior.

---

## Decisions resolved (from brief recommendations)

These match the brief's recommendations. **Push back before build if any are wrong.**

### Template content storage

**Decision:** DB table (`tenant_notification_templates`).

**Rationale:** Already exists, already supports EN/ES/PT versioning, already in use. Content edits don't require deploys. Matches existing convention.

### Deferred-doc reminder content

**Decision:** Count + link only. Do NOT enumerate missing docs in the SMS body.

**Rationale:** Keeps SMS short. Avoids re-stating jargon. The link drops them back into the flow where the actual list lives. Reduces SMS character cost.

**Example body:** `"Hi Maria — you still have 3 documents to finish your housing application. Pick up where you left off: <link>"`

### Reminder system unification

**Decision:** One system covers both deferred-doc reminders AND general "you haven't completed this" reminders. Same notification type (`docs_upload_reminder` — already in the table), same anti-spam rules, same event audit trail.

**Rationale:** Two parallel reminder systems = two places to fix bugs and two cadences to reason about. The brief's recommendation; lock it.

### Reminder cadence

**Decision:** 3 days after intake → first nudge. 7 days → second. Then weekly until application is submitted, opted-out, or 6 weeks have passed (then escalate to staff queue).

**Rationale:** Standard ramp. The 6-week cutoff prevents indefinite nudging and creates a clear staff handoff point.

### Tenant timezone

**Decision:** Default to `America/New_York`. Add `tenant_timezone` column on `pbv_full_applications` only if Cowork finds a need during build (likely yes — flag for build).

**Rationale:** All initial Stanton properties are in CT. National scale requires per-tenant TZ; defer the migration until needed but stub the column read so the upgrade path is clean.

---

## Core Features

### F1 — Pre-flight checklist SMS

**Goal:** Immediately after intake bridge completes, tenant receives an SMS listing exactly the documents they need to gather, conditional on their intake answers, in their preferred language.

**Files (verify during build):**
- New notification type: add `'pbv_preflight_checklist'` to `NotificationType` const in `lib/notifications/types.ts` and to the `tenant_notification_templates` table seed.
- Trigger: `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — after the bridge succeeds, call `sendTenantNotification({ applicationId, notificationType: 'pbv_preflight_checklist', interpolations })`.
- Template renderer: `lib/notifications/render.ts` — extend to accept a `doc_list` interpolation parameter (string of bulleted lines, pre-rendered per-tenant).
- Doc-list builder: new module `lib/notifications/buildPreflightDocList.ts`. Reads filtered doc list (PRD-40 F4 output), maps each `doc_type` to a one-liner content key (sourced from PRD-41's `docTypeHelp`, stripped to single-sentence summary), joins with `✓ ` bullets, returns the string + a fallback for "we couldn't determine your list."

**Template shape (EN, one of three rows seeded for `pbv_preflight_checklist`):**

```
Hi {{tenant_name}} — to finish your housing application, gather these:

{{doc_list}}

When you have them, tap your link:
{{magic_link}}
```

**Doc-list content source:**
- Reuse PRD-41's `docTypeHelp` if available. If not yet built (PRD-41 hasn't shipped), seed a minimal table or inline mapping in `buildPreflightDocList.ts` for the 22 required doc types with EN/ES/PT one-liners. Flag in build report that this duplicates PRD-41 content if PRD-41 lands later — schedule a content-source consolidation.
- One-liner per doc, plain language, no jargon. "Last 4 paystubs from your job" not "Paystubs (last 4 weekly or 2 bi-weekly per employed person)".
- If a doc is conditionally required only when a non-citizen member exists, include in list only when triggered (mirrors PRD-40 F4 gating).

**Idempotency:**
- The `intake/complete` route already emits a unique event ID. Pass that as `triggeredByEventId`. Existing send infrastructure rejects duplicates.

**Acceptance:**
- Maria (wage-earner, Checking, citizen, no kids) submits intake. SMS arrives within 30 seconds. Body lists Paystubs, Checking statement, Photo ID, signed forms (one collective line for the 11 generated forms, not 11 lines). No SSI, no TANF, no Immigration in her list. EN content.
- Replay `intake/complete` (idempotency test). No second SMS sent.
- Tenant with `preferred_language: 'es'` gets Spanish body.
- Tenant with no phone on file → email fallback fires per existing infra. SMS notification row marked `blocked_missing_data`.
- Opted-out tenant → no send. Notification row `blocked`.

### F2 — Deferred-doc reminder cadence

**Goal:** When a tenant defers docs (PRD-42 "I'll get this later") OR sits with docs missing past the time threshold, send a brief recap SMS with a link back into the flow.

**Files (verify during build):**
- Reuse `'docs_upload_reminder'` notification type (already in `lib/notifications/types.ts`).
- Update existing template body in `tenant_notification_templates` for `docs_upload_reminder` to match the new "count + link only" decision. Bump version, keep prior version archived (active=false).
- New trigger source 1: `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts` (new endpoint — PRD-42 calls this when "I'll get this later" is tapped). Schedules the first reminder for `now + 3 days`.
- New trigger source 2: scheduled job — new cron/edge function `app/api/cron/pbv-deferred-reminders/route.ts`. Runs daily, queries applications with `intake_submitted=true`, `application_submitted=false`, `docs_missing > 0`, and last-reminder-sent > 3 days ago (or never). Fires reminders per the cadence schedule below.
- New table OR new column on `pbv_full_applications`: `next_reminder_scheduled_at TIMESTAMPTZ NULL`. Tracks when the next nudge fires. Allows manual override + audit visibility. Recommend new column on existing application row to avoid new table overhead.

**Cadence schedule (locked):**
- Day 3 (since intake): first reminder
- Day 7: second reminder
- Day 14: third reminder
- Then weekly: day 21, 28, 35
- Day 42 (6 weeks): final reminder + emit `application_events` row `staff_escalation_required` for admin queue visibility. No further automated reminders after that.

**Anti-spam guardrails (F3 in the brief, folded into F2):**
- **Cap:** max 2 reminders per tenant per calendar week. The cadence schedule above respects this by construction; this cap is a safety net.
- **Engagement pause:** if the tenant uploaded any document in the last 24 hours, skip this cycle's send. Re-evaluate next cycle.
- **Quiet hours:** no sends 9pm–9am tenant local time. Default TZ `America/New_York`. If `tenant_timezone` column exists, use it; otherwise default.
- **Submission stop:** zero sends after `application_status = 'submitted'`. Hard check at top of send path.
- **Opt-out stop:** existing infrastructure handles. Reaffirm in test plan.

**Template shape (`docs_upload_reminder` updated body, EN):**

```
Hi {{tenant_name}} — you still have {{missing_count}} documents to finish your housing application.

Pick up where you left off: {{magic_link}}
```

Interpolations: `tenant_name`, `missing_count` (from PRD-40 F4 gated count), `magic_link`.

**Acceptance:**
- Maria defers 3 docs via PRD-42 "I'll get this later" (mock the endpoint). 3 days later, scheduled reminder fires with body "you still have 3 documents..." Link drops her into card stack.
- Maria uploads 1 doc within 24h of a scheduled reminder. Reminder skipped this cycle. Logged as `paused_recent_engagement`.
- Maria submits application before day 7 reminder. No further reminders. Day 7 cron run skips her row.
- Day 42 reaches, Maria still incomplete. Final reminder fires. `staff_escalation_required` event emitted. Day 49 cron run does NOT fire another reminder for Maria.
- Maria's local time is 11pm. Scheduled reminder is deferred to 9am next morning. Logged as `deferred_quiet_hours`.

---

## Out of scope

- Email-only reminders (separate channel, different cadence). Email fallback for blocked SMS is in scope.
- Voice / IVR reminders.
- Staff-initiated manual nudges (UI for staff to push a one-off SMS). The infra supports it; UI is a separate ticket.
- Reminder copy A/B testing infrastructure.
- Per-doc-type reminder variants ("you still need your paystubs specifically"). Brief explicitly chose count+link.
- Cross-application reminders (one tenant, multiple applications).
- Multi-tenant timezone migration as a hard requirement — column added only if Cowork finds it necessary during build.

---

## Open questions for Cowork to verify before build

1. **`docTypeHelp` source coordination with PRD-41.** If PRD-41 is mid-build (it is, per Alex 2026-05-17), confirm whether `docTypeHelp` is structured as a JSON/TS file that PRD-43's `buildPreflightDocList.ts` can import directly, or a DB table requiring a query. Either works — confirm before scoping the F1 trigger handler.
2. **Cron / scheduled job infrastructure.** Does the project already use a cron framework (Vercel Cron, Supabase scheduled functions, external scheduler)? If yes, use it. If no, scoping needs to include the scheduler setup. Search `vercel.json` and `app/api/cron/` for prior art.
3. **Per-tenant timezone.** Search `pbv_full_applications` schema for `timezone` / `tz` columns or any per-tenant TZ surface. If none exists, the brief defers the migration. Confirm whether Cowork wants to add the column proactively in PRD-43 or leave for a later national-scale PRD.
4. **`docs_upload_reminder` existing usage.** Even though the type is in the templates table, confirm whether any code path currently sends it. If yes, the version bump must coordinate with whatever ships it today.
5. **`staff_escalation_required` event consumer.** PRD-43 emits the event at day 42; verify (or create) the admin queue surface that consumes it. Otherwise the event has no audience.

---

## Acceptance summary (end-to-end test)

Use chrome-devtools-mcp + a Twilio test number (or staging Twilio account):

1. Provision fresh tenant. Complete intake as Maria. SMS arrives within 30s with pre-flight checklist matching her declared income/assets (PRD-40 F4 gating).
2. Verify EN content. Switch tenant `preferred_language` to `'es'`, replay (or new tenant). Spanish body.
3. Replay `intake/complete` endpoint via curl. No second SMS. Notification table shows idempotency hit.
4. Mock-defer a doc via PRD-42 endpoint (or direct SQL update on `application_documents` if PRD-42 isn't live yet). Fast-forward `next_reminder_scheduled_at` to past. Cron run. Reminder fires with count+link.
5. Upload a doc. Fast-forward cron schedule. Reminder skipped — `paused_recent_engagement` logged.
6. Submit application. Cron run. Maria's row no longer surfaced. No reminder.
7. Force scheduled reminder during tenant's local 11pm. Send deferred to 9am. Logged.
8. Opt out via inbound STOP webhook. Subsequent reminders blocked.

If all 8 pass, PRD-43 ships.

---

## Phasing

**Phase 1:** F1 pre-flight checklist (intake/complete trigger, template seed, doc-list builder). Lowest risk, highest immediate value.
**Phase 2:** F2 deferred reminders (defer endpoint stub if PRD-42 hasn't landed, cron job, cadence schedule, anti-spam).
**Phase 3:** Staff escalation event + day-42 cutoff.

Phase 1 alone delivers Tenant 1 value. Phase 2 + 3 are needed once PRD-42's "I'll get this later" affordance is live.

---

## Build prompt

Paired implementation prompt: `docs/fullApp-Plan/prompts/43-pbv-outbound-comms_prompt_2026-05-17.md`
