# Event Substrate Generalization — Build Report
**Date:** 2026-05-14  
**Feature:** Event Substrate Generalization + Save-Path Verification Standard  
**Status:** COMPLETE — all 8 phases shipped

---

## What Was Built

Generalized the `application_events` table from a hard FK anchored to `pbv_full_applications`
to a polymorphic anchor pattern (`anchor_type TEXT`, `anchor_id UUID`). Established a new
save-path verification standard using PGlite real-DB integration tests.

---

## Schema Change

### Before (pre-migration)
```sql
application_events (
  id                   UUID PRIMARY KEY,
  full_application_id  UUID NOT NULL REFERENCES pbv_full_applications(id),
  event_type           TEXT NOT NULL,
  actor_user_id        TEXT,
  actor_display_name   TEXT NOT NULL,
  document_id          UUID REFERENCES form_submission_documents(id),
  payload              JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           TEXT        -- was incorrectly NOT NULL, fixed in pre-flight
)
```

### After (post-migration)
```sql
application_events (
  id                   UUID PRIMARY KEY,
  anchor_type          TEXT NOT NULL CHECK (anchor_type IN ('pbv_full_application')),
  anchor_id            UUID NOT NULL,
  event_type           TEXT NOT NULL,
  actor_user_id        TEXT,
  actor_display_name   TEXT NOT NULL,
  document_id          UUID REFERENCES form_submission_documents(id),
  payload              JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           TEXT        -- nullable
)
```

Index: `idx_application_events_anchor (anchor_type, anchor_id, created_at DESC)`

---

## Helper API

### Before
```typescript
writeApplicationEvent({ fullApplicationId, eventType, ... })
```

### After — generic primitive (internal)
```typescript
writeApplicationEvent({ anchorType, anchorId, eventType, ... })
```

### After — PBV caller interface
```typescript
writePbvApplicationEvent({ applicationId, eventType, ... })
```

All route callers migrated to `writePbvApplicationEvent`. The generic primitive is
not called directly from route handlers.

---

## Defects Found and Fixed During Build

| Defect | Found In | Fix |
|--------|----------|-----|
| `created_by NOT NULL` with no default blocked all event writes | Phase 3 health check | `ALTER TABLE application_events ALTER COLUMN created_by DROP NOT NULL` |
| Properties routes used `fullApplicationId: 'system'` (non-UUID) | Phase 5 caller audit | Removed the broken event writes; added TODO comment for future `system` anchor type |

---

## Files Changed

### New files
- `lib/events/anchor.ts` — `resolveAnchor()` utility
- `lib/__tests__/_db.ts` — PGlite test harness
- `lib/__tests__/harness-smoke.test.ts` — Phase 1 harness smoke tests
- `lib/__tests__/schema-contract.test.ts` — Phase 2 schema column-match tests
- `lib/__tests__/save-path-integration.test.ts` — Phase 6 save-path tests
- `supabase/migrations/20260513200000_application_events_generalize.sql`

### Modified — helper
- `lib/events/application-events.ts` — rewrote params interface + added `writePbvApplicationEvent`

### Modified — routes (13 files)
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/reject/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/waive/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/categorize/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/assign/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/tier2/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/tier2/flag/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/upload/route.ts`
- `app/api/admin/submissions/documents/bulk-assign/route.ts`
- `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`
- `app/api/admin/pbv/full-applications/[id]/reopen/route.ts`
- `app/api/admin/pbv/full-applications/[id]/lead/route.ts`
- `app/api/admin/pbv/full-applications/bulk-lead/route.ts`
- `app/api/signing/packets/route.ts`
- `app/api/signing/execute-hap/route.ts`
- `app/api/signing/signatures/[id]/route.ts`
- `app/api/admin/signing/[signatureId]/apply/route.ts`
- `app/api/tenant/signing/[token]/[signatureId]/apply/route.ts`
- `app/api/admin/properties/route.ts` (broken write removed)
- `app/api/admin/properties/[address]/route.ts` (broken write removed)

### Modified — tests
- `lib/__tests__/document-lifecycle-phase1.test.ts`
- `lib/__tests__/review-workflow-phase1.test.ts`
- `lib/__tests__/signing-api.test.ts`

---

## Save-Path Verification Standard

For any future feature that writes to `application_events`:

### 1. Schema-contract check (before code)
Add a column assertion to `schema-contract.test.ts` for any new column. Run:
```
npm test -- schema-contract
```

### 2. Write helper usage (always)
- Use `writePbvApplicationEvent` for PBV workflows.
- For new workflow types, add a new anchor type to the `CHECK` constraint and create
  a new typed wrapper (e.g., `writeRefiApplicationEvent`).
- Never call `writeApplicationEvent` directly from a route handler.
- Never insert into `application_events` outside `lib/events/application-events.ts`.

### 3. Integration test (before merge)
Add a test to `save-path-integration.test.ts` for each new event type. The test must:
- Seed FK rows (form_submission, application)
- Call `writeEventDirect()` with the event payload
- Assert: `anchor_type`, `anchor_id`, `event_type`, all payload fields

### 4. Empirical health check (after deploy)
Run the following SQL immediately after deploying a migration or new event write path:
```sql
SELECT anchor_type, anchor_id, event_type, actor_display_name, document_id, payload, created_at
FROM application_events
ORDER BY created_at DESC LIMIT 10;
```
Expected: rows with `anchor_type = 'pbv_full_application'`, valid UUIDs in `anchor_id`,
no NULL `actor_display_name`, no empty `payload`.

---

## Phase Completion Summary

| Phase | Description | Result |
|-------|-------------|--------|
| 1 | PGlite test harness | ✅ 6/6 |
| 2 | Schema-column-match smoke tests | ✅ 24/24 |
| 3 | Pre-migration health check | ✅ 7/7 save paths confirmed |
| 4 | Schema migration | ✅ Applied, 7 rows backfilled |
| 5 | Helper rewrite + caller migration | ✅ 19 routes migrated |
| 6 | Save-path integration tests | ✅ 10/10 |
| 7 | Post-migration health check | ✅ All rows in new shape |
| 8 | Verification methodology doc | ✅ This document |
