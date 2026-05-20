# Build Report: PRD-43 — Tenant Outbound Comms (Pre-flight + Deferred Reminders)

**Date:** 2026-05-17  
**Status:** Complete  
**Branch:** `feat/pbv-outbound-comms-43`  
**Target:** PRD-43 implementation  

---

## Pre-build Verification Results

### 1. docTypeHelp Source Coordination ✅
- **Found:** `lib/pbv/docTypeHelp.ts` exists with comprehensive EN/ES/PT content
- **Decision:** Import directly from existing module - no duplication needed
- **Coverage:** 34 doc types with English complete, ES/PT marked as TODO (per PRD-40 Q2 decision)

### 2. Cron Infrastructure ✅  
- **Found:** Vercel cron already configured in `vercel.json`
- **Existing:** `/api/cron/notifications/scheduled-sends` (hourly) and `/api/cron/cleanup-idempotency-keys` (daily)
- **Decision:** Extend existing infrastructure with new `/api/cron/pbv-deferred-reminders` endpoint

### 3. docs_upload_reminder Existing Usage ⚠️
- **Found:** Manual trigger from admin dashboard (`app/admin/pbv/full-applications/[id]/send-sms/route.ts`)
- **Impact:** Template version bump could affect manual sends
- **Mitigation:** Archived old version before activating new version

---

## Phase 1: Pre-flight Checklist SMS ✅

### F1.1 - Notification Type Added
**File:** `lib/notifications/types.ts`
- Added `PBV_PREFLIGHT_CHECKLIST: 'pbv_preflight_checklist'` to NotificationType const
- TypeScript build passes

### F1.2 - Doc-list Renderer Built  
**File:** `lib/notifications/buildPreflightDocList.ts` (new)
- Queries filtered doc list using existing `filterByTriggers` function
- Maps doc types to one-liners using `docTypeHelp` content
- Groups 11 signed forms into single bullet point
- Handles fallbacks gracefully with logging
- Returns `{ docListText, fallbackUsed }` interface

### F1.3 - Template Seeded
**Migration:** `supabase/migrations/20260517234110_pbv_preflight_checklist_template.sql`
- INSERT 3 rows (EN/ES/PT) with `{{tenant_name}}`, `{{doc_list}}`, `{{magic_link}}` interpolations
- EN template canonical, ES/PT translations provided
- All `active=true`, `version=1`

### F1.4 - Trigger Wired
**File:** `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- Added imports for notification functions
- Added non-blocking send after bridge succeeds
- Uses unique event ID for idempotency: `intake-complete-{appId}-{timestamp}`
- Extracts tenant name and generates magic link
- Wrapped in try/catch - won't fail intake completion

---

## Phase 2: Deferred-doc Reminders ✅

### F2.1 - Template Updated (v2)
**Migration:** `supabase/migrations/20260517234128_pbv_docs_upload_reminder_v2.sql`
- Archived existing v1 templates (`active=false`)
- INSERT new v2 templates with "count + link only" format
- New interpolations: `{{tenant_name}}`, `{{missing_count}}`, `{{magic_link}}`
- EN/ES/PT translations provided

### F2.2 - Scheduling Columns Added
**Migration:** `supabase/migrations/20260517234135_pbv_application_reminder_schedule.sql`
- `next_reminder_scheduled_at TIMESTAMPTZ NULL`
- `reminders_sent_count INTEGER NOT NULL DEFAULT 0`
- Index on `next_reminder_scheduled_at WHERE NOT NULL` for cron efficiency

### F2.3 - Defer Endpoint Created
**File:** `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts` (new)
- POST endpoint for PRD-42 "I'll get this later" affordance
- Marks document as `deferred` status
- Schedules first reminder for +3 days if none exists sooner
- Emits `document.deferred` event
- Stub implementation - PRD-42 will expand state management

### F2.4 - Cron Job Built
**File:** `app/api/cron/pbv-deferred-reminders/route.ts` (new)
- Daily cron (scheduled 10am in Vercel)
- Cadence: [3, 7, 14, 21, 28, 35, 42] days
- Anti-spam guardrails:
  - Submission stop (double-check)
  - Engagement pause (24h upload window)
  - Quiet hours (9pm-9am tenant local)
  - Per-week cap (max 2/week)
- Day 42 escalation: emits `staff.escalation_required` event
- Comprehensive logging and error handling

### F2.5 - Vercel Cron Updated
**File:** `vercel.json`
- Added `/api/cron/pbv-deferred-reminders` with `0 10 * * *` schedule

---

## Event Types Added ✅

**File:** `lib/events/application-events.ts`
- `DOCUMENT_DEFERRED: 'document.deferred'`
- `STAFF_ESCALATION_REQUIRED: 'staff.escalation_required'`
- Payload types defined for both events in `EventPayloadMap`

---

## Translation Status

### Pre-flight Checklist Templates
- **EN:** ✅ Complete (canonical)
- **ES:** ✅ Complete ("Hola {{tenant_name}} — para terminar tu solicitud...")
- **PT:** ✅ Complete ("Olá {{tenant_name}} — para finalizar sua solicitação...")

### Reminder Templates (v2)
- **EN:** ✅ Complete ("Hi {{tenant_name}} — you still have {{missing_count}} documents...")
- **ES:** ✅ Complete ("Hola {{tenant_name}} — aún te faltan {{missing_count}} documentos...")
- **PT:** ✅ Complete ("Olá {{tenant_name}} — você ainda tem {{missing_count}} documentos...")

---

## Cadence Implementation

**Constant:** `const REMINDER_CADENCE_DAYS = [3, 7, 14, 21, 28, 35, 42]`
- Matches PRD specification exactly
- Day 42: final reminder + staff escalation
- Post-day 42: `next_reminder_scheduled_at = NULL`

---

## Database Changes Summary

1. **Templates:** 6 new rows (3 pre-flight + 3 reminder v2)
2. **Applications:** 2 new columns (`next_reminder_scheduled_at`, `reminders_sent_count`)
3. **Index:** 1 new index for cron query efficiency
4. **Event Types:** 2 new types with payload schemas

All migrations are idempotent and reversible.

---

## Testing Coverage

### Unit Tests Needed
- `buildPreflightDocList` scenarios:
  - Wage-earner with Checking account
  - SSI recipient with Savings account  
  - Immigrant family with conditional docs
- Cron guardrails:
  - Quiet hours deferral
  - Recent upload pause
  - Weekly limit enforcement
  - Day 42 escalation

### End-to-End Tests (per PRD)
1. Fresh tenant intake → pre-flight SMS arrives
2. Replay intake → no duplicate SMS (idempotency)
3. No phone tenant → email fallback
4. Opted-out tenant → blocked send
5. Defer doc → 3-day reminder schedule
6. Recent upload → reminder paused
7. Submit application → reminders stop
8. Day 42 → escalation event emitted

---

## Dependencies & Coordination

### PRD-41 (docTypeHelp)
- ✅ Already available - imported directly
- No coordination needed

### PRD-42 (card stack + defer UI)
- ⚠️ Defer endpoint created as stub
- PRD-42 will call `/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer`
- No blocking dependencies

### Admin Dashboard
- ⚠️ Manual `docs_upload_reminder` trigger exists
- Template v2 activated - manual sends now use new format
- Consider updating admin UI to show new template content

---

## Security & Compliance

- ✅ All database writes use `supabaseAdmin`
- ✅ No direct Twilio calls - uses `sendTenantNotification` only
- ✅ Idempotency via `triggeredByEventId` 
- ✅ Opt-out gates preserved
- ✅ Email fallback for missing phones
- ✅ RLS considerations (new columns inherit existing policies)

---

## Rollback Plan

If issues arise:
1. Disable cron: Remove from `vercel.json`
2. Revert templates: Set v1 `active=true`, v2 `active=false`
3. Stop pre-flight: Remove notification send from `intake/complete`
4. Database: Migrations are reversible if needed

---

## Next Steps

1. **Deploy migrations** to production
2. **Test Phase 1** end-to-end with fresh tenant
3. **Monitor pre-flight SMS** delivery and content
4. **Test Phase 2** with manual defer calls
5. **Verify cron execution** after first daily run
6. **Update PRD-43 status** from "Draft" to "Shipped"

---

## Files Changed

### Core Implementation
- `lib/notifications/types.ts` - Added PBV_PREFLIGHT_CHECKLIST
- `lib/notifications/buildPreflightDocList.ts` - New doc-list renderer
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` - Added pre-flight trigger
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts` - New defer endpoint
- `app/api/cron/pbv-deferred-reminders/route.ts` - New cron job
- `lib/events/application-events.ts` - Added event types

### Database
- `supabase/migrations/20260517234110_pbv_preflight_checklist_template.sql`
- `supabase/migrations/20260517234128_pbv_docs_upload_reminder_v2.sql`
- `supabase/migrations/20260517234135_pbv_application_reminder_schedule.sql`

### Configuration
- `vercel.json` - Added cron job

---

**Build completed successfully.** PRD-43 ready for deployment and testing.
