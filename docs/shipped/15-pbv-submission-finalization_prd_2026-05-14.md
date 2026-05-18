# PRD-15 — PBV Tenant Submission Finalization & Locking

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Correctness / data integrity
**Sequence:** Spawned from PRD-14 Phases 1 + 2. PRD-14 retains scope of Document Categorization (its own Phase 4). PRDs 16-21 cover the remaining PRD-14 phases.
**Depends on:** None.
**Blocks:** PRD-18 (Multi-signer correctness — its finalize-counts-all-signatures check needs the finalize endpoint), PRD-20 (Already-submitted re-entry — needs `submitted_at`).

---

## Problem Statement

The PBV full application has no server-persisted "submitted" invariant. The tenant's done-ness is computed live from doc statuses and signature counts, which means:

1. **`setPageState('confirmed')` is never called anywhere in the codebase** — verified via grep. The success screen render block at `app/pbv-full-app/[token]/page.tsx:1517` is dead code. The last-signer-done handler at line ~1384 bounces the tenant back to `docs_ready`, where they can reload and re-sign indefinitely.
2. **No server-side guard** prevents a tenant from re-submitting signatures or re-uploading documents after they think they're done.
3. **Multi-signer canvas handoff** calls `sigCanvasRefs.current.clear()` (line 658) which empties the refs Map rather than clearing each canvas. [Speculation] Probably works because new refs re-register, but never been tested with a 2-adult household. The user has a real 2-adult household coming through.
4. **No atomic finalize endpoint** — there's nothing to call, no idempotent commit point, no event log entry marking the transition.

This PRD adds the persisted invariant (`submitted_at`), the atomic endpoint, the client wiring, the multi-signer fix, and the server-side write guards. After this lands, "submitted" is a fact in the database, not a derived computation.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| `setPageState('confirmed')` is never called | Grep across full repo — zero matches | Verified |
| `pageState === 'confirmed'` render block exists at line ~1517 | Read `app/pbv-full-app/[token]/page.tsx` | Verified |
| Last-signer-done handler at line ~1384 sets `pageState='docs_ready'` instead of completing | Read | Verified |
| `sigCanvasRefs.current.clear()` at line 658 empties the Map | Read | Verified — behavior under multi-signer load not tested |
| Main page POSTs signatures to `/api/t/[token]/pbv-full-app/signatures` | Read | Verified |
| No `/api/t/[token]/pbv-full-app/finalize` endpoint exists | Glob | Verified |
| `pbv_full_applications.submitted_at` column does not exist | [Unverified] — needs DB query confirmation | Confirm before applying migration |

---

## Key decisions

### 1. `submitted_at TIMESTAMPTZ` on `pbv_full_applications` is the single source of truth for "done"

Not a derived count, not a flag in `application_events`, not a status enum. One nullable timestamp column. Set once. Never unset by tenant code. Admin code may set it to NULL for an explicit reopen (out of scope for this PRD — admin reopen is PRD-17 or later).

### 2. The finalize endpoint is atomic and idempotent

`POST /api/t/[token]/pbv-full-app/finalize` validates completion server-side, writes `submitted_at`, writes an `application_events` row, and returns the canonical state. Replays return the original result (via either an idempotency check or a no-op write when `submitted_at` is already set). The client is dumb — it calls finalize and renders what comes back.

### 3. Server-side write guards on every tenant mutation endpoint

After `submitted_at` is set, every tenant write endpoint (intake POST, document upload, signature save) returns 409 with a clear message. Client-side state is convenience; the guard is the contract.

### 4. The canvas handoff bug ships in this PRD, not PRD-18

PRD-18 (multi-signer correctness) owns the deeper multi-signer work (per-signer event logging, signature review preview). But the canvas refs fix is a 2-line change that unblocks the user's current 2-adult household. Bundling it here means PRD-15 alone delivers "a real household can complete and lock the application."

### 5. The `already_submitted` re-entry UI is NOT in this PRD

PRD-15 sets the column and the server-side guard. The page state already has a branch at `pageState === 'already_submitted'` (lines 690-707 — currently a placeholder). PRD-15 wires the load handler to route to that placeholder when `submitted_at IS NOT NULL`. PRD-20 builds the real read-only re-entry UI. The placeholder is acceptable in the interim because the server guard prevents any actual mutation.

---

## Scope

### What this PRD does

1. Adds `submitted_at TIMESTAMPTZ NULL` to `pbv_full_applications` (migration).
2. Builds `POST /api/t/[token]/pbv-full-app/finalize`.
3. Updates `GET /api/t/[token]/pbv-full-app` to include `submitted_at` in the response.
4. Wires client load handler: when `submitted_at IS NOT NULL`, set `pageState='already_submitted'`.
5. Wires client last-signer-done handler: replace `setPageState('docs_ready')` with finalize POST → on success `setPageState('confirmed')`, on failure render error with retry.
6. Adds server-side `submitted_at` write guards to: intake POST, document upload route (whichever path is canonical for the tenant), signature save endpoint.
7. Adds `application_events` row writes for `application_submitted` event type on finalize success.
8. Fixes `sigCanvasRefs.current.clear()` at page.tsx:658 → iterate and clear each canvas before resetting the Map.

### What this PRD does NOT do

- Add the `tenant_idempotency_keys` table (PRD-19, Resilience). Finalize replay-safety is handled by re-reading `submitted_at` and returning the existing state — no separate idempotency-key table needed for this endpoint.
- Build the `already_submitted` read-only UI (PRD-20).
- Per-signer event logging or signature review preview (PRD-18).
- Admin reopen / unlock flow.
- Touch the orphan `/signing` subpage (PRD-16).

---

## Affected files

### New migration

| File | What |
|---|---|
| `supabase/migrations/20260514210000_pbv_submitted_at.sql` | `ALTER TABLE pbv_full_applications ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;` plus an index on `(submitted_at) WHERE submitted_at IS NOT NULL` for the load-handler hot path. No backfill — existing applications are not retroactively marked submitted in this PRD. |

### New API route

| Route | Method | Purpose |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | POST | Resolves token → app. If `submitted_at IS NOT NULL`, return 200 with the existing `submitted_at` (replay-safe). Otherwise: validate that every required `application_documents` row is `submitted` / `approved` / `waived`, AND every required signature is saved, then write `submitted_at = now()` and an `application_events` row, return 200. On validation failure: 422 with `{ missing: { documents: [...], signatures: [...] } }`. |

### Modified API routes

| Route | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/route.ts` GET | Include `submitted_at` in response. |
| `app/api/t/[token]/pbv-full-app/route.ts` POST (intake) | Reject with 409 if `submitted_at IS NOT NULL` on the resolved app. |
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | Reject with 409 if `submitted_at IS NOT NULL`. |
| `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` AND/OR the canonical tenant doc upload endpoint (confirm which is live before editing) | Reject with 409 if `submitted_at IS NOT NULL`. |

### Modified client file

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` | (a) Load handler reads `submitted_at` from GET response; if set, `setPageState('already_submitted')`. (b) Last-signer-done handler at line ~1384: replace `setPageState('docs_ready')` with `await finalize()` → on success `setPageState('confirmed')`, on validation failure render a localized error with retry button, on network failure render retry. (c) Fix `sigCanvasRefs.current.clear()` at line 658: `sigCanvasRefs.current.forEach(c => c?.clear()); sigCanvasRefs.current.clear();`. |

---

## Phases

### Phase 1 — Migration + GET response

| # | Step | Verify |
|---|---|---|
| 1.1 | Apply `20260514210000_pbv_submitted_at.sql`. | Column exists. Index exists. Re-running migration is a no-op. |
| 1.2 | Update `GET /api/t/[token]/pbv-full-app` to SELECT and return `submitted_at`. | Manual: GET returns `submitted_at: null` for an in-progress app. |

### Phase 2 — Finalize endpoint

| # | Step | Verify |
|---|---|---|
| 2.1 | Build `POST /api/t/[token]/pbv-full-app/finalize`. Validation logic mirrors the existing `next_step === 'complete'` computation — extract it into a shared helper if it's currently inlined in the GET handler. | Unit test: empty app → 422 with `missing.documents` and `missing.signatures` populated. Complete app → 200 with `submitted_at` set. Replay → 200 with the SAME `submitted_at`, no mutation. |
| 2.2 | Add `application_events` row write on transition from null → submitted. Event type `application_submitted` (add to the enum if it doesn't exist — [Speculation] enum may need extension). | Database row appears once on first finalize. Replay does NOT add a second row. |

### Phase 3 — Client wiring

| # | Step | Verify |
|---|---|---|
| 3.1 | Load handler: if GET returns `submitted_at: <timestamp>`, set `pageState='already_submitted'`. Reuse the existing placeholder render at lines 690-707 until PRD-20 ships. | Manual: finalize a test app via curl, reload the tenant page, see the placeholder (not the form). |
| 3.2 | Last-signer-done handler at line ~1384: replace `setPageState('docs_ready')` with `await fetch('/api/t/' + token + '/pbv-full-app/finalize', { method: 'POST' })`. Parse response. On 200: `setPageState('confirmed')`. On 422: render localized validation error with retry button. On 5xx: render localized network error with retry button. | E2E: complete the flow, see the `SuccessScreen` at line 1517. Reload: see the `already_submitted` placeholder. |
| 3.3 | Fix canvas refs: `app/pbv-full-app/[token]/page.tsx:658`. Replace `sigCanvasRefs.current.clear()` with `sigCanvasRefs.current.forEach(c => c?.clear()); sigCanvasRefs.current.clear();`. Same fix at line ~618 if it has the identical pattern. | Manual: 2-adult test app. Signer 1 signs → handoff → signer 2 sees blank canvases (not signer 1's strokes) → signer 2 signs → finalize succeeds. |

### Phase 4 — Server-side write guards

| # | Step | Verify |
|---|---|---|
| 4.1 | Intake POST (`app/api/t/[token]/pbv-full-app/route.ts`): after resolving the app, check `submitted_at`. If non-null, return 409 with localized message. | Manual: finalize an app, then POST intake to its token — returns 409. |
| 4.2 | Signature save endpoint: same guard. | Manual: finalize, then POST signatures — returns 409. |
| 4.3 | Document upload endpoint(s): same guard. Confirm which endpoint is canonical for tenant uploads (there are parallel trees per PRD-14 audit) — at minimum guard the one the tenant page actually calls. | Manual: finalize, then POST upload — returns 409. |

### Phase 5 — Verification

| # | Step | Verify |
|---|---|---|
| 5.1 | E2E manual: 1-adult test app. Complete intake → docs → signatures → finalize → see `SuccessScreen`. | Pass. |
| 5.2 | E2E manual: 2-adult test app. Complete with handoff. | Pass. |
| 5.3 | Replay test: finalize twice with the same token. Second call returns 200 with identical `submitted_at`, no duplicate event row. | Pass. |
| 5.4 | Attack test: with a finalized app, hit each mutation endpoint directly via curl. All return 409. | Pass. |
| 5.5 | Reload test: finalize, then reload the tenant page. Land on `already_submitted` placeholder. | Pass. |

---

## Verification

### Definition of done

1. `pbv_full_applications.submitted_at` column exists in production.
2. A tenant who completes the flow reaches the `SuccessScreen` and `submitted_at` is set in the database.
3. Reloading the page after finalize lands on `already_submitted`, not the form.
4. No mutation endpoint accepts a write when `submitted_at IS NOT NULL`.
5. 2-adult canvas handoff works — signer 2's canvases are blank, not pre-filled with signer 1's strokes.
6. Replay finalize is a no-op.

---

## Rollback

- Migration is additive (ADD COLUMN). Inverse: `ALTER TABLE pbv_full_applications DROP COLUMN submitted_at;` — applications drop back to derived-state behavior.
- Finalize endpoint can be deleted. Client falls back to the prior `setPageState('docs_ready')` behavior via revert.
- Server-side guards can be reverted independently — each is a 3-line check.
- Canvas refs fix can be reverted independently.

---

## Open questions

1. **[Unverified]** Does `application_events` have a constrained `event_type` enum? If yes, the Phase 2.2 migration needs to add `application_submitted` to the enum. Read the events table schema before writing the finalize endpoint.
2. **[Unverified]** Which document upload endpoint is canonical for the tenant — `/api/pbv-full-app/[token]/documents/[doc_row_id]/upload` or `/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload` (if PRD-16 has landed) or both? Confirm by reading `components/pbv/TenantDocumentUpload.tsx` fetch call before adding the guard.
3. **[Speculation]** The validation logic at finalize time may already exist in the GET handler's `next_step` computation. If it does, extract it into a shared helper rather than duplicating. If it doesn't, write it once in a helper and use it from both places going forward.
4. **[Inference]** Replay safety via re-reading `submitted_at` should be sufficient for this endpoint without a separate idempotency-key table. If concurrent finalize calls race in a way that double-writes the event row, PRD-19's idempotency table is the right home for that fix.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | `submitted_at` is a column on the parent table, not an event-derived state | A timestamp is the simplest persisted invariant. Computed state was the existing bug. |
| 2026-05-14 | Replay safety via re-read, not idempotency-key table | Finalize is a single-shot transition. Re-reading `submitted_at` is sufficient; an idempotency key adds machinery without value here. |
| 2026-05-14 | Canvas refs fix ships here, not in PRD-18 | The user has a 2-adult household in scope right now. PRD-18 owns the deeper multi-signer work; this is just a 2-line bug fix that unblocks today. |
| 2026-05-14 | `already_submitted` render is a placeholder until PRD-20 | The server guard prevents mutation; the placeholder text is acceptable interim UX. Real re-entry UI is a separate concern. |
