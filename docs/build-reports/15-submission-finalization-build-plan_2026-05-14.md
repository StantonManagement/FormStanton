# PRD-15: Submission Finalization & Locking — Build Plan

**Status:** Awaiting user confirmation  
**Created:** 2026-05-14  
**Prompt:** `docs/15-pbv-submission-finalization-prompt_2026-05-14.md`  
**PRD:** `docs/15-pbv-submission-finalization_prd_2026-05-14.md`  

---

## Open Decisions — Confirmed

| # | Question | Finding | Decision |
|---|----------|---------|----------|
| 1 | `application_events.event_type` enum? | Free-text in DB (not enum) | Add `APPLICATION_SUBMITTED: 'application.submitted'` to TypeScript `ApplicationEventType` constant |
| 2 | Canonical tenant document upload endpoint? | `/api/pbv-full-app/${token}/documents/${docId}/upload` | Guard this endpoint only (matches PRD-14 parallel tree audit) |
| 3 | Completion-validation helper exists? | Inlined in GET handler lines 146-152 | Extract into `lib/pbv/finalizeValidation.ts` |
| 4 | Error message strings? | Need 3 new keys | Add to `pbvFullAppTranslations.ts` with EN/ES/PT copy (see below) |

### Error Message Copy (Confirmed)

| Key | English | Spanish | Portuguese |
|-----|---------|---------|------------|
| `finalize_validation_error` | "Some items are still missing. Please review and try again." | "Algunos elementos aún faltan. Por favor revise e intente de nuevo." | "Alguns itens ainda estão faltando. Por favor, revise e tente novamente." |
| `finalize_network_error` | "We couldn't submit your application. Please try again." | "No pudimos enviar su solicitud. Por favor intente de nuevo." | "Não conseguimos enviar sua solicitação. Por favor, tente novamente." |
| `submitted_locked_message` | "Application already submitted" (server 409) | "Solicitud ya enviada" | "Solicitação já enviada" |

---

## Implementation Commits

### Commit 1 — Migration + Event Type

**Files:**
- `supabase/migrations/20260514210000_pbv_submitted_at.sql` (new)
- `lib/events/application-events.ts` (modify)

**Migration:**
```sql
-- PRD-15: persist tenant submission as a server-side invariant.
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_pbv_full_applications_submitted_at
  ON public.pbv_full_applications (submitted_at)
  WHERE submitted_at IS NOT NULL;
```

**Event Type Addition:**
Add `APPLICATION_SUBMITTED: 'application.submitted'` to `ApplicationEventType` constant (alphabetically sorted).

---

### Commit 2 — Validation Helper + GET Response

**Files:**
- `lib/pbv/finalizeValidation.ts` (new)
- `app/api/t/[token]/pbv-full-app/route.ts` (modify)

**Helper Contract:**
```typescript
export async function validateReadyToFinalize(
  applicationId: string
): Promise<{
  ready: boolean;
  missing: {
    documents: string[];  // doc_type values still missing
    signatures: string[]; // member names with pending signatures
  };
}>;
```

**GET Response Change:**
- SELECT `submitted_at` from `pbv_full_applications`
- Return `submitted_at: app.submitted_at` in response body

---

### Commit 3 — Finalize Endpoint

**File:** `app/api/t/[token]/pbv-full-app/finalize/route.ts` (new)

**Behavior:**
1. Resolve token → application row
2. If `submitted_at IS NOT NULL`: return 200 with `{ submitted_at }` (replay-safe, no new event)
3. Else: call `validateReadyToFinalize`
4. If `!ready`: return 422 with `{ missing }`
5. Else: in transaction, set `submitted_at = now()` and insert `application_events` row with `event_type='application.submitted'`
6. Return 200 with `{ submitted_at }`

---

### Commit 4 — Client Wiring + Canvas Refs Fix

**File:** `app/pbv-full-app/[token]/page.tsx` (modify)

**Changes:**

1. **Load handler** (~line 424-438):
   - After GET resolves, if `data.submitted_at` is non-null, `setPageState('already_submitted')` before any other state setter

2. **Last-signer-done handler** (~line 1384):
   Replace:
   ```typescript
   setPageState('docs_ready')
   ```
   With:
   ```typescript
   const res = await fetch(`/api/t/${token}/pbv-full-app/finalize`, { method: 'POST' });
   if (res.ok) {
     setPageState('confirmed');
   } else if (res.status === 422) {
     const body = await res.json();
     setSigError(t.finalize_validation_error);
   } else {
     setSigError(t.finalize_network_error);
   }
   ```
   Add retry button wiring to re-call finalize.

3. **Canvas refs fix** (line 658 and line 618):
   Replace:
   ```typescript
   sigCanvasRefs.current.clear();
   ```
   With:
   ```typescript
   sigCanvasRefs.current.forEach(c => c?.clear());
   sigCanvasRefs.current.clear();
   ```

4. **Translation strings**: Add the 3 new keys to `pbvFullAppTranslations.ts`

---

### Commit 5 — Server-Side Write Guards

**Files:**
- `app/api/t/[token]/pbv-full-app/route.ts` (POST handler)
- `app/api/t/[token]/pbv-full-app/signatures/route.ts` (POST handler)
- `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` (POST handler)

**Guard Pattern:**
```typescript
if (app.submitted_at) {
  return NextResponse.json(
    { success: false, message: 'Application already submitted', code: 'submitted_locked' },
    { status: 409 }
  );
}
```

---

## Verification Checklist

Per `docs/verification-methodology_2026-05-13.md`:

- [ ] Migration drill: fresh DB and existing DB pass cleanly
- [ ] Finalize unit tests: empty/partial/complete/replay scenarios
- [ ] E2E manual: 1-adult test app completes end-to-end
- [ ] E2E manual: 2-adult test app with handoff
- [ ] Attack test: curl POSTs to guarded endpoints after finalize → all 409
- [ ] Reload test: finalize, reload, land on placeholder (not form)
- [ ] Multi-signer canvas test: signer 2 sees blank canvases
- [ ] Replay test: finalize twice → second returns 200 with same `submitted_at`, no duplicate event
- [ ] Build / lint / type-check clean

---

## Rollback Procedures

| Component | Rollback Command |
|-----------|------------------|
| Migration | `ALTER TABLE pbv_full_applications DROP COLUMN submitted_at; DROP INDEX idx_pbv_full_applications_submitted_at;` |
| Event type | Remove `APPLICATION_SUBMITTED` from `ApplicationEventType` |
| Finalize endpoint | Delete `app/api/t/[token]/pbv-full-app/finalize/route.ts` |
| Client wiring | Revert to `setPageState('docs_ready')` |
| Server guards | Remove 3-line `submitted_at` checks from each endpoint |
| Canvas fix | Revert to single `.clear()` call |

---

## Build Report Location

`docs/build-reports/15-submission-finalization-build-report_2026-05-14.md` (will be created after implementation)

---

## Dependencies

- **Blocks:** PRD-18 (Multi-signer correctness), PRD-20 (Already-submitted re-entry)
- **Parallel-safe with:** PRD-14, PRD-16 (no file overlap)

---

**Waiting for user confirmation to proceed with implementation.**
