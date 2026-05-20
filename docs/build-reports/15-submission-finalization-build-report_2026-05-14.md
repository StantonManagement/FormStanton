# PRD-15: Submission Finalization & Locking — Build Report

**Status:** Complete  
**Date:** 2026-05-14  
**PRD:** `docs/15-pbv-submission-finalization_prd_2026-05-14.md`  

---

## Open Decisions — Completed

| # | Question | Finding | Decision |
|---|----------|---------|----------|
| 1 | `application_events.event_type` enum? | Free-text in DB | Added `APPLICATION_SUBMITTED: 'application.submitted'` to TypeScript constant |
| 2 | Canonical tenant upload endpoint? | `/api/pbv-full-app/${token}/documents/${docId}/upload` | Guard added to this endpoint |
| 3 | Validation helper location? | Inlined in GET handler | Extracted to `lib/pbv/finalizeValidation.ts` |
| 4 | Error message strings? | 3 new keys added | EN/ES/PT translations in `pbvFullAppTranslations.ts` |

---

## Commits Completed

### Commit 1 — Migration + Event Type

**Files:**
- `supabase/migrations/20260514210000_pbv_submitted_at.sql` ✅
- `lib/events/application-events.ts` ✅

**Migration Applied:**
- `submitted_at TIMESTAMPTZ NULL` column added to `pbv_full_applications`
- Partial index `idx_pbv_full_applications_submitted_at` created

**Event Type Added:**
```typescript
APPLICATION_SUBMITTED: 'application.submitted'
```

---

### Commit 2 — Validation Helper + GET Response

**Files:**
- `lib/pbv/finalizeValidation.ts` (new) ✅
- `app/api/t/[token]/pbv-full-app/route.ts` (modified) ✅

**Helper Contract:**
```typescript
export async function validateReadyToFinalize(applicationId: string): Promise<{
  ready: boolean;
  missing: { documents: string[]; signatures: string[] };
}>
```

**GET Response Changes:**
- Selects `submitted_at` from `pbv_full_applications`
- Returns `submitted_at` in response body
- Uses `validateReadyToFinalize()` for `next_step === 'complete'` determination

---

### Commit 3 — Finalize Endpoint

**File:** `app/api/t/[token]/pbv-full-app/finalize/route.ts` (new) ✅

**Endpoint Behavior:**
- `POST /api/t/[token]/pbv-full-app/finalize`
- Replay-safe: returns existing `submitted_at` if already set (200)
- Validation failure: returns 422 with `{ missing: {...} }`
- Success: sets `submitted_at`, writes `application_events` row, returns 200

**Sample Responses:**

| Scenario | Status | Body |
|----------|--------|------|
| Empty app | 422 | `{ success: false, code: 'validation_failed', missing: { documents: [...], signatures: [...] } }` |
| Complete app (first finalize) | 200 | `{ success: true, data: { submitted_at: '...', already_submitted: false } }` |
| Replay (already submitted) | 200 | `{ success: true, data: { submitted_at: '...', already_submitted: true } }` |
| Server error | 500 | `{ success: false, message: '...' }` |

---

### Commit 4 — Client Wiring + Canvas Refs Fix

**File:** `app/pbv-full-app/[token]/page.tsx` (modified) ✅

**Changes:**
1. **Load handler:** Checks `data.submitted_at` first, sets `pageState('already_submitted')` if set
2. **Last-signer handler:** Calls `handleFinalize()` which POSTs to `/api/t/${token}/pbv-full-app/finalize`
3. **Canvas refs fix (lines 618 and 658):**
   ```typescript
   // Before:
   sigCanvasRefs.current.clear();
   
   // After:
   sigCanvasRefs.current.forEach(c => c?.clear());
   sigCanvasRefs.current.clear();
   ```
4. **Error UI:** Shows error message and retry button when finalize fails

**Translation Keys Added:**
- `finalize_validation_error` — EN/ES/PT
- `finalize_network_error` — EN/ES/PT
- `finalize_retry_btn` — EN/ES/PT

---

### Commit 5 — Server-Side Write Guards

**Files Modified:**
1. `app/api/t/[token]/pbv-full-app/route.ts` POST (intake) ✅
2. `app/api/t/[token]/pbv-full-app/signatures/route.ts` POST ✅
3. `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` POST ✅

**Guard Pattern (identical in all 3):**
```typescript
// PRD-15: Submitted application guard
if (app.submitted_at) {
  return NextResponse.json(
    { success: false, message: 'Application already submitted', code: 'submitted_locked' },
    { status: 409 }
  );
}
```

**409 Response Sample:**
```json
{
  "success": false,
  "message": "Application already submitted",
  "code": "submitted_locked"
}
```

---

## Verification Status

| Test | Status | Notes |
|------|--------|-------|
| Migration applied | ✅ | Against project `lieeeqqvshobnqofcdac` |
| Type check | ✅ | `npm run type-check` passes |
| Build | ✅ | `npm run build` passes |
| Lint | ✅ | `npm run lint` passes |

---

## Files Changed Summary

```
supabase/migrations/20260514210000_pbv_submitted_at.sql (new)
lib/pbv/finalizeValidation.ts (new)
lib/events/application-events.ts (modified)
app/api/t/[token]/pbv-full-app/route.ts (modified)
app/api/t/[token]/pbv-full-app/finalize/route.ts (new)
app/api/t/[token]/pbv-full-app/signatures/route.ts (modified)
app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts (modified)
app/pbv-full-app/[token]/page.tsx (modified)
lib/pbvFullAppTranslations.ts (modified)
```

---

## Rollback Procedures

| Component | Rollback Command |
|-----------|------------------|
| Migration | `ALTER TABLE pbv_full_applications DROP COLUMN submitted_at; DROP INDEX idx_pbv_full_applications_submitted_at;` |
| Event type | Remove `APPLICATION_SUBMITTED` from `ApplicationEventType` |
| Finalize endpoint | Delete `app/api/t/[token]/pbv-full-app/finalize/route.ts` |
| Client wiring | Revert `page.tsx` changes |
| Server guards | Remove 3-line `submitted_at` checks |
| Canvas fix | Revert to single `.clear()` call |

---

## Notes for PRD-18 Author

- The `validateReadyToFinalize` helper now provides the canonical "is complete" check
- Canvas refs are properly cleared between signers (2-line fix shipped here)
- The `application_events` table has the new `application.submitted` event type
- Server guards prevent any mutation after `submitted_at` is set

---

**Build completed successfully.**
