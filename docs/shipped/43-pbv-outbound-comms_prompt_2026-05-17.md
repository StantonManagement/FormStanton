# Prompt — PRD-43: Tenant Outbound Comms (Pre-flight + Deferred Reminders)

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/43-pbv-outbound-comms_prd_2026-05-17.md`
**Target branch:** `feat/pbv-outbound-comms-43`

---

## Status: ready to build

Twilio + Resend infrastructure is live (`lib/notifications/send.ts`, shipped 2026-05-14 per `docs/shipped/05-pbv-04-tenant-notifications-prd_2026-05-14.md`). PRD-43 adds one new notification type, updates an existing template body, and adds a scheduled reminder cron. No new client SDKs, no new opt-out plumbing.

This PRD ships **before** PRD-42 because it works against today's directory-style `/documents` page and delivers Tenant 1 value independently.

---

## Read first

1. The PRD: `docs/fullApp-Plan/43-pbv-outbound-comms_prd_2026-05-17.md`
2. The brief: `local:uploads/prd-43-brief_outbound-comms.md` (Alex's original brief)
3. Existing notification send path: `lib/notifications/send.ts`
4. Existing template renderer: `lib/notifications/render.ts`
5. Existing types: `lib/notifications/types.ts`
6. Existing migration that created the templates table: `supabase/migrations/20260514120000_tenant_notifications_unified.sql`
7. The shipped PRD-04 (notifications foundation): `docs/shipped/05-pbv-04-tenant-notifications-prd_2026-05-14.md`
8. Application events module: `lib/events/application-events.ts`
9. PRD-40 doc-gating output (for filtered doc list): `docs/fullApp-Plan/40-pbv-trust-safety-polish_prd_2026-05-17.md` — specifically F4

---

## Before you touch code — three pre-build verifications

These come from the PRD's open-questions list. Do these first; some may require Alex's input.

1. **`docTypeHelp` source coordination with PRD-41.** PRD-41 is mid-build per Alex 2026-05-17. Pre-flight SMS content needs per-doc one-liners. Either:
   - PRD-41 ships `docTypeHelp` as a TS module → PRD-43 imports it
   - PRD-41 ships it as a DB table → PRD-43 queries it
   - PRD-41 isn't done in time → PRD-43 seeds its own minimal inline mapping with TODO to consolidate later
   Check the PRD-41 build status. Confirm path with Alex if ambiguous.

2. **Cron / scheduled job infrastructure.** Search `vercel.json` and any `app/api/cron/` routes for prior art. If Vercel Cron is in use, F2 uses it. If not, scoping must include scheduler setup — flag for Alex.

3. **`docs_upload_reminder` existing usage.** The notification type is seeded in `tenant_notification_templates` but may have no trigger yet. Grep for `docs_upload_reminder` across the codebase. If anything fires it today, the version bump in F2 needs to be coordinated. If nothing fires it (likely), PRD-43 owns this type going forward.

Report findings before starting Phase 1.

---

## What you're building

Two notification flows on top of existing Twilio + Resend infrastructure:

1. **F1** — Pre-flight checklist SMS (sent immediately after intake completes)
2. **F2** — Deferred-doc reminder cadence (3d / 7d / 14d / weekly, max 6 weeks)

Plus anti-spam guardrails folded into F2's send path.

Target: 3-4 days. Phase 1 alone is ~1 day and ships independently.

---

## Order of operations

**Phase 1 first (F1 pre-flight). Phase 2 second (F2 reminders).** Phase 1 has no dependencies; Phase 2 needs the cron infrastructure decision (or buildout) plus the deferral endpoint that PRD-42 owns. Phase 1 can ship and deliver value while Phase 2 is built.

---

## Phase 1 — F1 Pre-flight checklist SMS

### Step 1 — Register the new notification type

**Files:**
- `lib/notifications/types.ts` — add to the `NotificationType` const:
  ```ts
  PBV_PREFLIGHT_CHECKLIST: 'pbv_preflight_checklist',
  ```

**Verify:** TypeScript build passes. The new type is referenced in F1 trigger and template seed below.

### Step 2 — Build the doc-list renderer

**File:** New module `lib/notifications/buildPreflightDocList.ts`

**Function shape:**
```ts
export async function buildPreflightDocList(
  applicationId: string,
  language: 'en' | 'es' | 'pt'
): Promise<{ docListText: string; fallbackUsed: boolean }>
```

**Implementation:**
- Query the PRD-40 F4 filtered doc list for this application. Whatever endpoint or service returns the gated documents per-tenant — use the same source so SMS and `/documents` page agree.
- For each doc type in the result, map to a per-language one-liner. Source from PRD-41's `docTypeHelp` if available; otherwise inline a fallback mapping in this module covering the 22 required doc types.
- Bundle the 11 signed forms into ONE bullet ("Stanton's forms to sign — we'll generate these for you"). Don't list each separately.
- Join with `✓ ` prefix and newline separator.
- If the doc list query fails or returns empty unexpectedly, log + return `{ docListText: '<generic fallback>', fallbackUsed: true }`. Generic fallback: "We'll show you the list in your application."

**One-liner content principles:**
- Plain language, no jargon: "Last 4 paystubs from your job" NOT "Paystubs (last 4 weekly or 2 bi-weekly per employed person)"
- Stanton's forms = one line, not eleven
- Conditional triggers (e.g., Immigration Docs) only appear when actually required

**Verify:** Unit-test for three scenarios: (a) wage-earner with Checking, (b) SSI recipient with Savings, (c) immigrant family. Each returns the expected bullets in EN.

### Step 3 — Seed the template

**Files:**
- New migration: `supabase/migrations/<date>_pbv_preflight_checklist_template.sql`

**Migration:**
- INSERT three rows into `tenant_notification_templates` for `notification_type='pbv_preflight_checklist'`, one each for `'en'`, `'es'`, `'pt'`, `version=1`, `active=true`.
- Body uses interpolations `{{tenant_name}}`, `{{doc_list}}`, `{{magic_link}}`.

**EN body (canonical — translate ES and PT):**
```
Hi {{tenant_name}} — to finish your housing application, gather these:

{{doc_list}}

When you have them, tap your link:
{{magic_link}}
```

ES and PT: authored at build time (per PRD-40 Q2 decision — full inline translations). Tentative phrasings get `-- PT: tentative — review` comments matching existing migration conventions.

**Verify:** Migration applies cleanly. SELECT confirms three rows present, all `active=true`.

### Step 4 — Wire the trigger in `intake/complete`

**File:** `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`

**Implementation:**
- After the bridge succeeds and the application is committed, call:
  ```ts
  const docList = await buildPreflightDocList(applicationId, tenant.preferred_language);
  await sendTenantNotification({
    applicationId,
    notificationType: NotificationType.PBV_PREFLIGHT_CHECKLIST,
    interpolations: {
      tenant_name: tenant.first_name ?? tenant.full_name,
      doc_list: docList.docListText,
      magic_link: tenantMagicLink,
    },
    triggeredByEventId: bridgeEventId, // existing event the bridge already emits
  });
  ```
- Do NOT await the response in a way that blocks intake completion. `sendTenantNotification` already returns gracefully on infra errors per its contract. If you want belt-and-suspenders, wrap in try/catch + log.

**Verify:**
- Submit intake as a fresh tenant. SMS arrives within 30s. Body matches expected for that tenant's intake answers.
- Replay `intake/complete` (curl with same idempotency key). No second SMS. Confirm via `tenant_notifications` table that the second attempt is idempotency-hit.
- Tenant with no phone → email fallback fires. Notification row marked `blocked_missing_data` or `email_fallback`.

### Step 5 — Phase 1 acceptance + check-in

Before moving to Phase 2, run all of Phase 1's verify steps end-to-end. Check in with Alex with:
- Verified file paths
- The three doc-list test outputs (EN, scenario a/b/c)
- Translation status for ES/PT (flag any tentatives for review)

---

## Phase 2 — F2 Deferred-doc reminders

### Step 6 — Update existing template body

**File:** New migration `supabase/migrations/<date>_pbv_docs_upload_reminder_v2.sql`

**Migration:**
- For each existing `(notification_type='docs_upload_reminder', language=X, active=true)` row, set `active=false` (archive).
- INSERT new rows with `version=N+1`, `active=true`, body matching the locked decision: count + link only.

**EN body:**
```
Hi {{tenant_name}} — you still have {{missing_count}} documents to finish your housing application.

Pick up where you left off: {{magic_link}}
```

Interpolations: `tenant_name`, `missing_count`, `magic_link`. Translate ES and PT at build time.

**Verify:** SELECT shows new version active, old version archived. No template returns two active rows for same (type, language) pair.

### Step 7 — Reminder scheduling column

**File:** New migration `supabase/migrations/<date>_pbv_application_reminder_schedule.sql`

**Migration:**
- `ALTER TABLE pbv_full_applications ADD COLUMN next_reminder_scheduled_at TIMESTAMPTZ NULL;`
- `ALTER TABLE pbv_full_applications ADD COLUMN reminders_sent_count INTEGER NOT NULL DEFAULT 0;`
- Index on `next_reminder_scheduled_at WHERE next_reminder_scheduled_at IS NOT NULL` for cron query efficiency.

**Verify:** Migration applies. Columns visible. Existing rows have NULL `next_reminder_scheduled_at` (cron will populate them on first tick).

### Step 8 — Defer endpoint (PRD-42 stub-or-real)

**File:** New route `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts`

**Behavior:**
- POST. Marks the doc as deferred (PRD-42 owns this state — coordinate on column/flag).
- Updates parent application's `next_reminder_scheduled_at = NOW() + INTERVAL '3 days'` if no nearer reminder is already scheduled.
- Emits `application_events` row `document_deferred`.

If PRD-42 isn't ready at PRD-43 build time, ship this endpoint as a stub that records the defer + schedules the reminder. PRD-42 calls it later from card stack UI. No coordination overhead.

**Verify:**
- POST to defer endpoint. Doc row state changes. Application `next_reminder_scheduled_at` set to now + 3 days. Event emitted.

### Step 9 — Cron job

**File:** New route `app/api/cron/pbv-deferred-reminders/route.ts`

**Behavior:**
- Run daily (verify cron infra during pre-build — Vercel Cron is the likely answer for Next.js apps).
- Query: applications where `application_status != 'submitted'` AND `intake_submitted = true` AND `next_reminder_scheduled_at <= NOW()` AND `next_reminder_scheduled_at IS NOT NULL`.
- For each result, evaluate anti-spam guardrails before sending:
  1. **Submission stop:** redundant with query but double-check — abort if submitted.
  2. **Engagement pause:** if `last_upload_at > NOW() - INTERVAL '24 hours'`, defer this cycle. Reschedule `next_reminder_scheduled_at` per cadence schedule. Log `paused_recent_engagement`.
  3. **Quiet hours:** if tenant local time is 21:00-09:00, push `next_reminder_scheduled_at` to next 9am tenant-local. Log `deferred_quiet_hours`. Skip send.
  4. **Per-week cap:** if `reminders_sent_count` in last 7 days >= 2, log and skip. (Cadence schedule respects this; this is the safety net.)
- For sends that pass guardrails: call `sendTenantNotification(notificationType: 'docs_upload_reminder', interpolations: { tenant_name, missing_count, magic_link })`. Then update `reminders_sent_count += 1` and schedule `next_reminder_scheduled_at` per the cadence below.

**Cadence schedule:**
- After first send (day 3): next at +4 days (day 7)
- After day 7: next at +7 days (day 14)
- After day 14: next at +7 days (day 21)
- After day 21: next at +7 days (day 28)
- After day 28: next at +7 days (day 35)
- After day 35: next at +7 days (day 42)
- Day 42: send final reminder. Emit `staff_escalation_required` event. Set `next_reminder_scheduled_at = NULL` permanently.

Store the cadence as a const array in the cron module so it's easy to inspect and adjust:
```ts
const REMINDER_CADENCE_DAYS = [3, 7, 14, 21, 28, 35, 42];
```

**Verify:**
- Mock-defer a doc. Fast-forward `next_reminder_scheduled_at`. Trigger cron via HTTP. Reminder fires. Count increments. Next reminder scheduled per cadence.
- Upload a doc within 24h of scheduled reminder. Cron run. Skip + reschedule. Log entry present.
- Tenant local time 11pm. Cron run. Send deferred to 9am tomorrow. Log entry present.
- Submit application. Cron run. Maria's row skipped or excluded by query. No reminder.
- Reach day 42. Final reminder fires. Escalation event emitted. Cron day 49 — no send.

### Step 10 — Phase 2 acceptance + check-in

Run the 8-step end-to-end test from the PRD. Check in with Alex.

---

## What to deliver

- Branch `feat/pbv-outbound-comms-43`
- Phase 1 commits (notification type, doc-list builder, template seed, intake/complete trigger)
- Phase 2 commits (template version bump, schedule column, defer endpoint, cron job)
- All migrations idempotent and reversible
- Unit tests for `buildPreflightDocList` (three scenarios minimum)
- Unit or integration test for cron guardrails (quiet hours, engagement pause, submission stop, day-42 escalation)
- Build report at `docs/build-reports/43-pbv-outbound-comms-build-report_<ship-date>.md` covering:
  - Pre-build verification answers (cron infra used, docTypeHelp source resolved, docs_upload_reminder existing usage)
  - Feature-by-feature what changed and what file paths were verified
  - Translation status for new strings (EN + ES + PT each flagged tentative or final)
  - The cadence as actually built — confirm matches the const array
- PRD-43 status updated from "Draft" to "Shipped"

---

## Gotchas

- **Don't call Twilio directly.** Only `sendTenantNotification` is allowed per `lib/notifications/send.ts` contract. Any code that bypasses it is a bug.
- **Idempotency depends on `triggeredByEventId`.** Pass it. Without it, replays of `intake/complete` will double-send.
- **Phone-missing tenants fall back to email.** Don't add new fallback logic; reuse existing infra. Confirm via test.
- **Quiet hours uses TENANT local time, not server time.** If `tenant_timezone` column doesn't exist yet, default to `America/New_York` and document the assumption. Flag for national-scale ticket.
- **Pre-flight content must match the documents page.** If PRD-40 F4 gating returns 13 docs and the SMS lists 22, tenants will be confused. Same source of truth.
- **Day-42 escalation event must have a consumer.** If admin doesn't have a surface that displays escalated applications, the event is silent. Verify with Alex during build whether admin needs a small UI surface added (probably yes, probably small).
- **The `docs_upload_reminder` version bump can break in-flight sends.** If any reminder is queued under the old template version, ensure it resolves cleanly. Recommendation: deactivate old version AFTER the new version is live and confirmed.
- **Don't enumerate the doc list in the reminder body** — that's F1's job. F2 is count+link only per locked decision.

---

## When something is ambiguous

Stop and ask. Specifically:
- If `intake/complete` doesn't currently emit a unique event ID, coordinate with Alex on idempotency strategy.
- If Vercel Cron isn't configured and the project uses a different scheduler, surface this immediately — scoping changes materially.
- If PRD-40 F4 is shipped but the doc-gating source isn't a clean importable module, the doc-list builder may need to duplicate logic. Don't duplicate silently — flag and decide.
- If `tenant_timezone` is needed and not present, scope the migration carefully and confirm before adding columns to a production table.
