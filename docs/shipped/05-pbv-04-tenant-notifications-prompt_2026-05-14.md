# Windsurf Prompt — PBV Tenant Notifications (Twilio Lifecycle Integration)

**PRD:** `docs/05-pbv-04-tenant-notifications-prd_2026-05-14.md` (read end-to-end before writing any code — the architecture rule section is binding)
**Build report (you create this):** `docs/build-reports/pbv-04-tenant-notifications-build-report_2026-05-14.md`
**Depends on:** `stanton-workspace-document-lifecycle` merged. `06-rejection-tenant-loop_prd_2026-04-24.md` merged (its rejection-template tables remain and this PRD wraps them). PRD-02 + PRD-03 merged (their event types feed several triggers here).
**Coordinates with:** `04-post-approval-execution_prd_2026-05-13.md` — its `hap_executed` event fires the move-in notification defined here.

---

## Context

Twilio is partially wired but not lifecycle-coordinated. Today: `lib/sendPortalLink.ts` sends a one-off magic-link SMS with hard-coded bodies. `lib/notifications.ts` handles document rejection notifications. `app/api/webhooks/twilio/route.ts` accepts delivery callbacks. That's it.

Missing: initial magic-link automation, doc-upload reminders, HACH-approval signing notification, signing reminders, move-in notice, STOP/HELP inbound handling, TCPA consent capture, bulk send, unified template registry.

This build unifies all of it into a single notification system: one template table, one send primitive, one trigger mapping, one cron scheduler, one inbound handler, one bulk send. Every existing SMS path routes through the new primitive.

The PRD is the source of truth. This prompt directs implementation.

**Architecture rule (binding):** All Twilio SMS sends go through `sendTenantNotification` in `lib/notifications/send.ts`. Direct calls to `twilioClient.messages.create` outside that file are forbidden. All event writes via `writePbvApplicationEvent`. Opt-out gate is non-bypassable.

---

## Required reading before you start

1. **`docs/05-pbv-04-tenant-notifications-prd_2026-05-14.md`** — entire document.
2. **`docs/06-rejection-tenant-loop_prd_2026-04-24.md`** + its tables — the rejection flow gets wrapped under the unified path; reason vocabulary stays.
3. **`docs/shipped/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — event substrate it depends on.
4. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory.
5. **`lib/events/application-events.ts`** — add new event types here. Confirm `writePbvApplicationEvent` extension points.
6. **`lib/sendPortalLink.ts`** + **`lib/notifications.ts`** — existing Twilio call sites. Both refactor to call the new primitive.
7. **`app/api/webhooks/twilio/route.ts`** — existing delivery webhook. Reuse signature validation pattern for the new inbound webhook.
8. **`supabase/migrations/20260424170000_rejection_reason_templates.sql`** — existing rejection template table. Coexists with the new one.
9. **`tenant_notifications` table definition** (find the migration via grep) — already exists; confirm `notification_type` accepts new values.
10. **`lib/auth.ts`**, **`lib/audit.ts`**, **`lib/supabase.ts`** — patterns.
11. **`lib/__tests__/schema-contract.test.ts`** + **`lib/__tests__/save-path-integration.test.ts`** — extend per phases.
12. **`vercel.json`** (or equivalent cron config) — confirm cron registration path.

---

## Closed decisions (do not relitigate)

Per PRD section "Closed Decisions":

1. Provider Twilio. Languages EN/ES/PT.
2. All event writes via `writePbvApplicationEvent`. New event types: `NOTIFICATION_SCHEDULED`, `NOTIFICATION_SENT`, `NOTIFICATION_FAILED`, `NOTIFICATION_OPTED_OUT`, plus `APPLICATION_CREATED` if not already present.
3. Template registry: new `tenant_notification_templates` table. `rejection_reason_templates` continues to exist.
4. Trigger model: declarative mapping `application_event.event_type → notification_type` in `lib/notifications/triggers.ts`. No hard-coded SMS-send calls from route handlers.
5. Reminder scheduling: Vercel cron, hourly. `notification_schedules` table.
6. Consent: `sms_consent_captured_at` + `sms_consent_text_version` + `sms_opted_out_at` columns on `pbv_full_applications`.
7. STOP/HELP/START at new inbound webhook.
8. Bulk send at admin-permission-gated endpoint.
9. Evidence standard: every code-claim backed by grep command + raw output.

---

## Decisions still open — confirm before coding the affected phase

Per PRD section "Open Questions for Windsurf":

1. **Rejection template migration.** Confirm coexistence vs merge. Recommended: keep `rejection_reason_templates` (reason vocab), add `tenant_notification_templates` (wrapper). Post grep + decision.
2. **Bulk-send permission.** Confirm existing admin permission gating project-scoped bulk ops. Post grep against `permissions` table + the permission code referenced.
3. **Phone number storage location.** Cross-PRD audit found `pbv_full_applications.phone` is selected at `app/api/t/[token]/pbv-full-app/route.ts:26-31`. Treat as primary. Confirm whether `form_submissions.phone` is a secondary/legacy source needing backfill. Post grep + sample row.
4. **Cron schedule registration.** Confirm `vercel.json` or `app/api/cron/*` convention. Register the hourly cron at `/api/cron/notifications/scheduled-sends`.

---

## Build this pass

Five phases per PRD section "Implementation Phases." Do not skip, merge, or reorder.

### Phase 1 — Schema + event types + consent capture

- Migration `supabase/migrations/<ts>_tenant_notifications_unified.sql`:
  - `tenant_notification_templates` table (schema per PRD).
  - `notification_schedules` table.
  - `tenant_inbound_messages` table.
  - `pbv_full_applications`: ADD `sms_consent_captured_at`, `sms_consent_text_version`, `sms_opted_out_at`.
  - Seed `tenant_notification_templates` EN/ES/PT for every `notification_type` in PRD §Core Features 1.
- Add new event types to `ApplicationEventType` in `lib/events/application-events.ts` with payload types.
- Persist consent in the existing application-creation path (Open Question 3). If the portal form was submitted with consent text, set `sms_consent_captured_at = now()` and `sms_consent_text_version = '2026-05-14-v1'`.

**Done when:**
- Migration applies clean. `\d` for all new tables + new columns.
- Template count per language = number of notification types.
- `grep -n "NOTIFICATION_SENT\|NOTIFICATION_FAILED\|NOTIFICATION_SCHEDULED\|NOTIFICATION_OPTED_OUT" lib/events/application-events.ts` returns definitions.
- Schema-contract test extended; green.

### Phase 2 — Send primitive + render + opt-out gate

- `lib/notifications/types.ts` (NotificationType enum).
- `lib/notifications/render.ts` (interpolation; degrade gracefully on missing slot).
- `lib/notifications/resolve.ts` (phone + language resolver — single source).
- `lib/notifications/send.ts` (the primitive `sendTenantNotification`).
- Refactor `lib/sendPortalLink.ts` to call the primitive for `magic_link_initial`. Keep old signature as shim.
- Refactor `lib/notifications.ts` (rejection) to call the primitive for `doc_rejected`. Confirm rejection-reason interpolation still resolves correctly.

**Done when:**
- Happy: send primitive fires Twilio (sandbox or mocked) and writes `tenant_notifications` row + `notification.sent` event. Raw.
- Opted-out: returns blocked, no Twilio call, emits `notification.opted_out`. Raw assertion.
- Template-missing: returns failed with reason, no Twilio call, emits `notification.failed`. Raw.
- `grep -rn "twilioClient.messages.create" lib app` returns exactly 1 call site (`lib/notifications/send.ts`).

### Phase 3 — Trigger model + reminder scheduler + cron

- `lib/notifications/triggers.ts` with the event-type → notification-type map per PRD §Core Features 4.
- Event-bus indirection in `lib/events/application-events.ts` that calls the trigger after every event write commits. Fire-and-forget — notification failures never roll back the originating event.
- On `APPLICATION_CREATED`: insert three `notification_schedules` rows (`docs_upload_reminder` at +3d, +7d, +14d) with `cancel_predicate='all_docs_uploaded'`.
- `lib/notifications/predicates.ts` with the `all_docs_uploaded` predicate.
- Cron endpoint `app/api/cron/notifications/scheduled-sends/route.ts`. Reads due `notification_schedules` rows, evaluates `cancel_predicate`, dispatches or cancels.

**Done when:**
- Creating a new `pbv_full_applications` row → `APPLICATION_CREATED` event → trigger fires → `magic_link_initial` sent → 3 reminders scheduled. Raw SQL of `notification_schedules`.
- Manual cron invocation processes due rows. Raw curl + SQL diff.
- `cancel_predicate` cancels reminders after docs uploaded. Raw evidence.
- `grep -rn "twilio.messages\|twilio\\.messages\\.create" app lib --include='*.ts' --include='*.tsx'` — only the send primitive should match.

### Phase 4 — Inbound webhook + bulk send

- `app/api/webhooks/twilio/inbound/route.ts`:
  - Validates X-Twilio-Signature (same pattern as existing delivery webhook).
  - Parses `Body`, case-insensitive keyword.
  - STOP → sets `sms_opted_out_at = now()` for all matching applications, emits `notification.opted_out` per app, sends auto-reply in EN (carrier requirement).
  - HELP → sends auto-reply in EN. No state change.
  - START → clears `sms_opted_out_at`, sends confirmation.
  - Any other inbound: insert into `tenant_inbound_messages` with `matched_keyword=null`, `handled=false`.
- `app/api/admin/notifications/bulk-send/route.ts`:
  - Permission-gated (Open Question 2).
  - Body: `{ notification_type, filter, dry_run }`.
  - Dry-run: return resolved application list + opt-out summary. No Twilio.
  - Wet-run: emit `bulk_send_initiated` with `bulk_send_id`. Fan out one `sendTenantNotification` per application; tag each with `bulk_send_id` in payload.

**Done when:**
- STOP inbound: opt-out applied across matching apps. Raw evidence.
- HELP inbound: response in EN. Raw curl.
- Bulk dry-run: list + opt-out summary, zero Twilio calls. Raw evidence.
- Bulk wet-run: N sends, all tagged. Raw evidence.
- Other inbound logged to `tenant_inbound_messages`. Raw SQL.

### Phase 5 — Admin visibility + verification

- Per-application notification timeline component on the existing application detail page (reads `tenant_notifications` for the application).
- Opt-out badge if `sms_opted_out_at` set.
- "Resend magic link" button → calls `magic_link_resent`.
- Failed-send list (admin dashboard panel or dedicated route — Windsurf chooses, document in build report).
- Save-path integration tests for every new event type + opt-out + template-missing + dry-run.

**Done when:**
- All save-path cases green.
- `npm test` zero failures.
- `npm run build` zero errors. Strict TS — no new `any`.
- Admin can see notification timeline on test application. Screenshot.
- All grep audits re-run in verification section. Same raw outputs.

---

## Tech constraints

- Next.js App Router
- Supabase admin client via `lib/supabase.ts`
- `twilio` npm package — already in bundle
- TypeScript strict — no new `any`
- Vitest
- Migrations idempotent (`IF NOT EXISTS`)
- No new libraries

---

## Hard NOs

- **Do NOT call `twilioClient.messages.create` from anywhere except `lib/notifications/send.ts`.** Every other call site must route through `sendTenantNotification`.
- **Do NOT bypass the opt-out gate.** No "internal" or "urgent" override in v1.
- **Do NOT let notification failures roll back the originating lifecycle event.** Sends happen after the event tx commits. Failures emit `notification.failed` and surface in admin only.
- **Do NOT throw on missing template.** Renderer leaves literal `{slot}` in place, logs warning, sends degraded message.
- **Do NOT introduce a new Twilio account/number.** Reuse existing env vars.
- **Do NOT delete or modify `rejection_reason_templates`.** It coexists with the new table.
- **Do NOT skip TCPA consent capture.** Phase 1 backfills consent on existing applications via a default — document this in the build report.
- **Do NOT add placeholder code or TODOs.**
- **Do NOT skip the verification phase.**
- **Do NOT collapse phases.**

---

## Verification phase (mandatory)

End-to-end checks. Skipping any of these means the task is not complete.

1. **Migrations apply clean.** `\d` for all new tables + new columns posted.
2. **Schema-contract test green.**
3. **`npm run build` zero errors.**
4. **TypeScript strict — no new `any`.**
5. **`npm test` zero failures.**
6. **Send happy path.** Creating an application → `magic_link_initial` → Twilio call (sandbox or mocked) → `tenant_notifications` row + `notification.sent` event. Raw curl + SQL.
7. **Opt-out path.** STOP inbound → `sms_opted_out_at` set → next send returns blocked → `notification.opted_out` event. Raw.
8. **Reminder cron.** 3 schedule rows inserted on `APPLICATION_CREATED`. Cron invocation processes due rows. Cancellation predicate works. Raw curl + SQL.
9. **Rejection path still works.** Rejecting a document → `doc_rejected` via unified path → existing rejection-reason interpolation produces correct copy. Raw output. **Critical regression check.**
10. **Bulk send dry-run.** Resolves matching applications + opt-out summary. Zero Twilio calls. Raw.
11. **Grep audits:**
    - `twilioClient.messages.create` call sites = 1 (in `lib/notifications/send.ts`).
    - `writeApplicationEvent` direct calls in `app/api` and `lib/notifications` = 0.
    - `INSERT INTO application_events` outside `lib/events/application-events.ts` = 0.
    - `tenant_notification_templates` callers = 1 (the renderer).
12. **TCPA consent backfill.** Existing applications (pre-migration) — confirm the backfill strategy applied and is documented.

If any of 1–12 fails, **do not declare done.** Stop, report, await instruction.

---

## Build report requirements

Create `docs/build-reports/pbv-04-tenant-notifications-build-report_2026-05-14.md`:

1. **Pre-build decisions.** Answers to all four Open Questions with grep evidence.
2. **Migrations.** Path, applied Y/N, `\d` for all new tables/columns, seed counts.
3. **PRD goals checklist.** Every Goal `[x]`/`[ ]` + one-line note.
4. **Files created.** One-line description each.
5. **Files modified.** Summary per file (especially `lib/sendPortalLink.ts`, `lib/notifications.ts`, `lib/events/application-events.ts`).
6. **Test results.** Full Vitest output. Per-phase acceptance criteria status.
7. **End-to-end send verification.** For each notification type: trigger condition, payload, SQL verification, raw output.
8. **Rejection regression check.** Detailed proof the rejection path still produces correct copy under the new unified primitive.
9. **STOP/HELP/START walkthrough.** Curl + state changes + auto-replies.
10. **Bulk send walkthrough.** Dry-run output, wet-run trace.
11. **Grep audit results.** All commands + raw outputs from verification §11.
12. **TCPA backfill strategy.** What you applied to existing applications.
13. **Deviations from PRD.** Reasoning. Empty if none.
14. **Pre-existing issues observed.** Anything broken/risky out of scope. Do not fix.
15. **Verification phase results.** Items 1–12 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report file length (lines), section count, confirmation every section is populated.
- Verification items 1–12 pass/fail.
- Notification timeline screenshot from admin.
- Rejection regression result (must be identical to pre-change).
- Grep audit summary (raw counts).
- Anything that blocked you.

If any test fails, any verif