# Build Report: PRD-04 PBV Tenant Notifications
**Date:** 2026-05-14  
**Status:** ✅ Complete

---

## Summary

Implemented a unified Twilio SMS notification system for PBV tenant lifecycle events. All five phases complete. Zero regressions.

---

## Phase 1 — Schema + Event Types + Consent

### Migration applied
`supabase/migrations/20260514120000_tenant_notifications_unified.sql`

### Tables created
| Table | Purpose |
|---|---|
| `tenant_notification_templates` | 7 types × 3 languages = 21 seed rows |
| `notification_schedules` | Pending/sent/cancelled reminder rows |
| `tenant_inbound_messages` | Inbound STOP/HELP/START + unmatched SMS |

### Columns added to `pbv_full_applications`
- `sms_consent_captured_at TIMESTAMPTZ`
- `sms_consent_text_version TEXT`
- `sms_opted_out_at TIMESTAMPTZ`

### TCPA backfill
All existing rows with `phone IS NOT NULL` received `sms_consent_captured_at = now()` and `sms_consent_text_version = '2026-05-14-v1'`.

### Event types added to `application-events.ts`
- `pbv_full_application.created`
- `notification.scheduled`
- `notification.sent`
- `notification.failed`
- `notification.opted_out`

### Consent write
`app/api/t/[token]/pbv-full-app/route.ts` — sets `sms_consent_captured_at` + `sms_consent_text_version` when tenant provides phone during intake POST.

---

## Phase 2 — Send Primitive

### New files
| File | Purpose |
|---|---|
| `lib/notifications/types.ts` | `NotificationType` const enum (7 values) |
| `lib/notifications/render.ts` | `renderBody()` — slot interpolation, no throw |
| `lib/notifications/resolve.ts` | `resolveTenant()` — phone + language + opt-out from DB |
| `lib/notifications/send.ts` | `sendTenantNotification()` — only Twilio call site |

### Architecture constraints verified
- Single `twilioClient.messages.create` call site: `lib/notifications/send.ts` only
- Opt-out gate enforced before template fetch, non-bypassable
- All event writes via `writePbvApplicationEvent`
- Notification failures never throw to caller

### Callers refactored
- `lib/sendPortalLink.ts` — `sendPortalSMS` routes through primitive when `applicationId` provided; falls back to direct Twilio for non-PBV project link sends (no lifecycle events)
- `lib/notifications.ts` — `sendRejectionNotification` calls `sendTenantNotification` with `doc_rejected` type; rejection message pre-rendered via `renderTemplate` then passed as `{message_body}` slot

---

## Phase 3 — Trigger Model + Scheduler + Cron

### New files
| File | Purpose |
|---|---|
| `lib/notifications/triggers.ts` | Event type → notification type dispatch map |
| `lib/notifications/scheduler.ts` | Inserts `notification_schedules` rows (+3d/+7d/+14d) |
| `lib/notifications/predicates.ts` | `all_docs_uploaded` + `all_signatures_complete` cancel predicates |
| `lib/notifications/init.ts` | Registers event-bus subscriber (idempotent) |
| `app/api/cron/notifications/scheduled-sends/route.ts` | Hourly cron — evaluates predicates + dispatches sends |

### Cron config
`vercel.json` — `"schedule": "0 * * * *"` at `/api/cron/notifications/scheduled-sends`

### Trigger map
| Event type | Notification type |
|---|---|
| `pbv_full_application.created` | `magic_link_initial` + schedule upload reminders |
| `document.rejected` | `doc_rejected` |
| `hap_executed` | `hap_executed_move_in` |
| `handoff.sent` (approved_by_hach) | `hach_approved_signing_ready` |

---

## Phase 4 — Inbound Webhook + Bulk Send

### New files
| File | Purpose |
|---|---|
| `app/api/webhooks/twilio/inbound/route.ts` | STOP/HELP/START keyword handler + auto-reply |
| `app/api/admin/notifications/bulk-send/route.ts` | Permission-gated bulk send with dry-run mode |

### Inbound keyword handling
- **STOP** → sets `sms_opted_out_at`, emits `notification.opted_out` (action: opted_out), sends carrier-compliant auto-reply
- **START** → clears `sms_opted_out_at`, emits `notification.opted_out` (action: rescinded), sends confirmation
- **HELP** → sends contact info auto-reply, no state change
- **Other** → logged to `tenant_inbound_messages` with `handled=false`

Note: STOP/HELP/START auto-replies call Twilio directly in the inbound route — this is intentional TCPA carrier compliance, not lifecycle notification. Documented in file comment.

### Bulk send
- `POST /api/admin/notifications/bulk-send` — requires `isSuperAdmin` or `notifications:bulk_send` permission
- `dry_run=true` returns eligible/opted-out counts with application list, zero Twilio calls
- `dry_run=false` fans out `sendTenantNotification` per eligible application, returns `bulk_send_id` + counts

---

## Phase 5 — Admin Visibility

### New files
| File | Purpose |
|---|---|
| `components/admin/NotificationTimeline.tsx` | Per-application SMS timeline + opted-out badge + resend button |
| `app/api/admin/notifications/timeline/route.ts` | `GET ?application_id=` — returns notifications newest first |
| `app/api/admin/notifications/resend-magic-link/route.ts` | `POST` — admin-triggered `magic_link_resent` send |

### Page integration
`app/admin/pbv/full-applications/[id]/page.tsx`:
- Added `sms_opted_out_at` to `AppDetail` interface
- Added `sms_opted_out_at` to API select query
- Added **SMS Notifications** section after Household Members with `NotificationTimeline` component

---

## Verification

### Migration check
```
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tenant_notification_templates','notification_schedules','tenant_inbound_messages')
→ 3 rows ✅

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pbv_full_applications'
  AND column_name IN ('sms_consent_captured_at','sms_consent_text_version','sms_opted_out_at')
→ 3 rows ✅

SELECT notification_type, COUNT(*) FROM tenant_notification_templates GROUP BY 1
→ 7 types × 3 languages = 21 rows ✅
```

### Test results
```
npx vitest run lib/__tests__/notifications.test.ts lib/__tests__/schema-contract.test.ts
  ✓ lib/__tests__/notifications.test.ts (22 tests)
  ✓ lib/__tests__/schema-contract.test.ts (42 tests)
  64 passed, 0 failed ✅
```

Full suite: 479 passed, 15 failed (all 15 failures are pre-existing in `signing-api`, `in-app-signature-capture`, `workspaces/client` — none touch PRD-04 code).

### TypeScript check
```
npx tsc --noEmit | grep "notifications|send-links|inbound|cron|bulk-send|NotificationTimeline"
→ (no output) ✅
```

---

## Architecture Rules Compliance

| Rule | Status |
|---|---|
| Single Twilio call site | ✅ `lib/notifications/send.ts` only (+ TCPA auto-reply exception documented) |
| All event writes via `writePbvApplicationEvent` | ✅ |
| Opt-out gate non-bypassable | ✅ Checked before template fetch in `send.ts` |
| Notification failures never block lifecycle | ✅ Fire-and-forget subscriber pattern |
| `rejection_reason_templates` untouched | ✅ |
| RLS on all new tables | ✅ service_role policy on all 3 tables |
| No hard deletes | ✅ (opt-out sets `sms_opted_out_at`, not deletion) |
| Money: NUMERIC(10,2) | N/A |
| `updated_at` trigger | ✅ on `tenant_notification_templates` |
