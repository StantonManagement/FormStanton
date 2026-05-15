# Cursor Prompt — PRD-15: Submission Finalization & Locking

**PRD:** `docs/15-pbv-submission-finalization_prd_2026-05-14.md` (read end-to-end; the "Key decisions" and "Closed decisions" sections are binding)
**Build report (you create this):** `docs/build-reports/15-submission-finalization-build-report_2026-05-14.md`
**Depends on:** None.
**Blocks:** PRD-18 (Multi-signer correctness), PRD-20 (Already-submitted re-entry).
**Parallel-safe with:** PRD-14 (Document categorization) and PRD-16 (Orphan removal). No file overlap.

---

## Context

The tenant PBV full application has no server-persisted "submitted" state. `setPageState('confirmed')` is never called anywhere in the codebase (verified via grep). The last-signer-done handler bounces tenants back to `docs_ready`, where they can reload and re-sign forever. There's no atomic commit point and no server-side write guard.

This build pass adds `submitted_at` as a column on `pbv_full_applications`, builds the atomic `/finalize` endpoint, wires the client to call it, adds 409 guards on every tenant mutation endpoint, and fixes the multi-signer canvas refs bug that strands strokes between adult signers.

The PRD is the source of truth. This prompt directs implementation.

---

## Required reading before you start

1. **`docs/15-pbv-submission-finalization_prd_2026-05-14.md`** — entire document.
2. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory.
3. **`app/pbv-full-app/[token]/page.tsx`** — specifically the `pageState` machine (line ~198), the signatures flow (lines 1357-1515), the last-signer-done handler (line ~1384), the canvas refs `useRef` and its `.clear()` calls (lines 278, 618, 658).
4. **`app/api/t/[token]/pbv-full-app/route.ts`** — current GET and POST handlers. The `next_step` computation logic for completion validation should be extracted into a shared helper if currently inlined.
5. **`app/api/t/[token]/pbv-full-app/signatures/route.ts`** — current signature save endpoint.
6. **The current tenant document upload endpoint** — confirm whether the live page calls `/api/pbv-full-app/[token]/documents/[doc_row_id]/upload` or a `/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload` (PRD-16 may have moved it). Grep `TenantDocumentUpload.tsx` for the fetch URL.
7. **`application_events` table schema** — confirm whether `event_type` is an enum and whether `application_submitted` is a permitted value. If enum: the Phase 2 migration adds the value. If free-text: just use the string.
8. **Any existing localized error strings in `lib/pbvFullAppTranslations.ts`** — finalize failures need user-facing messages.

---

## Closed decisions (do not relitigate)

Per PRD-15 "Key decisions" and "Decisions log":

1. `submitted_at TIMESTAMPTZ NULL` on `pbv_full_applications` is the single source of truth. Not derived.
2. Finalize endpoint is atomic and replay-safe via re-reading `submitted_at`. No idempotency-key table in this PR.
3. Server-side write guards on every tenant mutation endpoint return 409 when `submitted_at IS NOT NULL`.
4. Canvas refs fix ships in this PRD (Phase 3.3) — 2-line change.
5. `already_submitted` UI stays as the existing placeholder render block (lines 690-707) for now. PRD-20 builds the real read-only re-entry UI.
6. No backfill of `submitted_at` for existing applications. Out of scope.
7. Admin reopen / unlock is out of scope.

---

## Decisions still open — confirm before coding the affected phase

1. **`application_events.event_type` shape.** Read the schema. If enum: add `application_submitted` value in a small migration shipped alongside `20260514210000_pbv_submitted_at.sql`. If free-text: just use `'application_submitted'`. Post the discovery in chat.

2. **Canonical tenant document upload endpoint.** Two parallel trees exist per the PRD-14 audit. Grep `components/pbv/TenantDocumentUpload.tsx` for the fetch URL. Whichever path the tenant page actually calls today gets the server-side guard. If PRD-16 has consolidated to `/api/t/[token]/pbv-full-app/documents/...`, guard that one. If both still exist and either could be called, guard both. Post the finding in chat.

3. **Completion-validation helper location.** The `next_step === 'complete'` check almost certainly exists in the GET handler. Locate it. If it's inlined: extract into `lib/pbv/finalizeValidation.ts` (or similar) and have both GET and the new finalize endpoint use it. If it's already in a helper: use the same helper. Do NOT duplicate the validation logic. Post the helper path in chat.

4. **Localized error message strings.** Finalize endpoint validation failures (422) and server-guard 409s need tenant-facing messages. Add keys to `pbvFullAppTranslations.ts` for: `finalize_validation_error`, `finalize_network_error`, `submitted_locked_message`. Suggested copy (English): "Some items are still missing. Please review and try again." / "We couldn't submit your application. Please try again." / "Your application has already been submitted. Contact the office for changes." Sanity-check Spanish/Portuguese against existing translation conventions before committing. Post the copy in chat for sign-off.

---

## Build this pass

Five commits in one PR. Each is independently sensible. Do not merge units across commits.

### Commit 1 — Migration

Create `supabase/migrations/20260514210000_pbv_submitted_at.sql`:

```sql
-- PRD-15: persist tenant submission as a server-side invariant.
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_pbv_full_applications_submitted_at
  ON public.pbv_full_applications (submitted_at)
  WHERE submitted_at IS NOT NULL;
```

If open decision 1 returns "enum": ship a second migration adding `application_submitted` to the enum.

**Done when:**
- Column exists. Index exists.
- Re-running migration is a no-op.
- Inverse documented: `ALTER TABLE ... DROP COLUMN submitted_at;` plus index drop.

### Commit 2 — Validation helper + GET response

- Extract the completion-validation logic from the GET handler (or its existing helper) into `lib/pbv/finalizeValidation.ts` exposing a function like `validateReadyToFinalize(applicationId: string): Promise<{ ready: boolean; missing: { documents: string[]; signatures: string[] } }>`. The return shape must be reusable by both the GET handler's `next_step` computation and the new finalize endpoint.
- Update `GET /api/t/[token]/pbv-full-app` to SELECT and return `submitted_at` in the response body.

**Done when:**
- Manual: GET returns `submitted_at: null` for an in-progress app.
- The existing `next_step` logic still computes the same values it used to (test against an existing complete-ish app).
- Type-check passes.

### Commit 3 — Finalize endpoint

Create `app/api/t/[token]/pbv-full-app/finalize/route.ts`:

- POST. Resolves `token → pbv_full_applications` row.
- If `submitted_at IS NOT NULL`: return 200 with `{ submitted_at }`. Replay-safe.
- Else: call `validateReadyToFinalize`. If `!ready`: return 422 with `{ missing }`.
- Else: in a transaction, set `submitted_at = now()` and insert an `application_events` row with `event_type='application_submitted'`. Return 200 with `{ submitted_at }`.
- Use `supabaseAdmin` (service role) like other tenant endpoints in this tree.

**Done when:**
- Unit test (or curl): empty app → 422 with non-empty `missing.documents` / `missing.signatures`.
- Complete app → 200 with `submitted_at` set, one new `application_events` row.
- Replay → 200 with the SAME `submitted_at`, ZERO new event rows.
- DB inspection confirms idempotency.

### Commit 4 — Client wiring + canvas refs fix

`app/pbv-full-app/[token]/page.tsx`:

- **Load handler** (around line 428-438 where `pageState` is initially set): after GET resolves, if `data.submitted_at` is non-null, `setPageState('already_submitted')` before any other state setter. The existing placeholder render at lines 690-707 handles the rest.
- **Last-signer-done handler** at line ~1384: replace `setPageState('docs_ready')` with:
  ```ts
  const res = await fetch(`/api/t/${token}/pbv-full-app/finalize`, { method: 'POST' });
  if (res.ok) {
    setPageState('confirmed');
  } else if (res.status === 422) {
    const body = await res.json();
    setSigError(t.finalize_validation_error);
    // optionally surface body.missing in dev
  } else {
    setSigError(t.finalize_network_error);
  }
  ```
  Add a retry mechanism: the existing error UI in the signatures block already has a render path — wire the button to re-call finalize.
- **Canvas refs fix at line 658** (and line ~618 if it has the identical pattern):
  ```ts
  sigCanvasRefs.current.forEach(c => c?.clear());
  sigCanvasRefs.current.clear();
  ```

**Done when:**
- E2E manual: 1-adult test app. Sign last doc → click done → see `SuccessScreen`.
- Reload after finalize → land on the existing `already_submitted` placeholder, NOT the form.
- 2-adult test app: signer 1 signs → handoff → signer 2 sees blank canvases.
- Network failure on finalize: error message localized + retry button works.

### Commit 5 — Server-side write guards

Add a guard at the top of each tenant mutation endpoint after token resolution. Pattern (factor into a tiny helper if it appears more than twice):

```ts
if (app.submitted_at) {
  return NextResponse.json(
    { success: false, message: 'Application already submitted', code: 'submitted_locked' },
    { status: 409 }
  );
}
```

Apply to:
- `app/api/t/[token]/pbv-full-app/route.ts` POST (intake)
- `app/api/t/[token]/pbv-full-app/signatures/route.ts` POST
- Whichever document upload endpoint open decision 2 identifies as canonical (and any parallel-tree endpoint that might still be called)

**Done when:**
- Curl test against each guarded endpoint after a finalize: 409 with `code: 'submitted_locked'`.
- Existing tests on in-progress apps still pass (guard is only triggered when `submitted_at` is set).
- Grep audit: every tenant write endpoint either has the guard or has a documented reason in the build report for not needing it.

---

## Verification

Per `docs/verification-methodology_2026-05-13.md`. Specifics:

1. **Migration drill** — fresh DB and existing DB, both pass cleanly. Inverse rollback works.
2. **Finalize unit tests** — empty / partial / complete / replay scenarios all behave per spec.
3. **E2E manual** — 1-adult and 2-adult test apps, complete the flow end-to-end.
4. **Attack test** — curl POSTs against each guarded endpoint with a finalized token. All 409.
5. **Reload test** — finalize, reload, land on placeholder (not form).
6. **Multi-signer canvas test** — confirm signer 2 canvases are blank after handoff.
7. **Replay test** — finalize twice. Second call returns 200 with identical `submitted_at`. No duplicate event row.
8. **Build / lint / type-check** clean.

---

## Anti-patterns — do NOT

- Do not duplicate the completion-validation logic in the finalize endpoint. Use the shared helper from Commit 2.
- Do not add an idempotency-key table. Replay safety here is re-read; the idempotency-key table belongs to PRD-19.
- Do not build the real `already_submitted` UI. That's PRD-20. Use the existing placeholder.
- Do not extend canvas handoff fixes beyond the 2-line `.forEach` change. Deeper multi-signer work is PRD-18.
- Do not unset `submitted_at` from tenant code anywhere. The column is set-once for tenant flows.
- Do not widen scope into PRD-17 (rejection loop), PRD-18 (multi-signer events), PRD-19 (resilience), or PRD-20 (already-submitted UI).
- Do not add new mutation endpoints that bypass the guard. If you find any not listed in Commit 5, post in chat before adding code.

---

## Build report (you write this)

Create `docs/build-reports/15-submission-finalization-build-report_2026-05-14.md` covering:

- Migration applied: yes/no, when, against which DB(s)
- Open decision 1 (event_type enum) — discovery and decision
- Open decision 2 (canonical upload endpoint) — discovery and guard placement
- Open decision 3 (validation helper location) — final helper path
- Open decision 4 (error message copy) — final strings, language sign-off
- Sample finalize response bodies for the four scenarios (empty / partial / complete / replay)
- Sample 409 response from each guarded endpoint
- 2-adult canvas test result with photo or video link
- Any deviations from this prompt, with rationale
- Anything you'd flag for the PRD-18 author to be aware of

---

## When you're done

Post in chat:
1. PR link
2. Build report path
3. Open questions Alex needs to weigh in on before merge
4. Confirmation that the verification checklist above is fully green

Do not merge without Alex's sign-off.
