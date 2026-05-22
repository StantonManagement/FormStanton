# PRP-013 — Idempotency Scoping, Finalize Atomicity & Error Surfacing

**Assigned batch (per BATCH_PLAN.md):** 03
**Source:** `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` — **#9**, **#10**, **#13** (the workflow-audit items not already remediated).
**Depends on:** None — operates on current `main`. (Assumes current `main` already fixed the `withIdempotency` *clock* comparison; **#9 here is a different change — `application_id` scoping in the lookup — not the clock fix.** A `finalize_pbv_application` RPC already exists with a `WHERE submitted_at IS NULL` guard.)
**Inputs (read before editing):** `lib/idempotency.ts` (~17–22 the lookup WHERE), `app/api/t/[token]/pbv-full-app/finalize/route.ts` (~49–69 the submit-then-event sequence), the `finalize_pbv_application` SQL function, `lib/pbv/form-generation/source-pdfs.ts` (~30–36 `tryLoadPdf`).
**Outputs (write — the ONLY files this PRP may modify/create):** `lib/idempotency.ts`, `app/api/t/[token]/pbv-full-app/finalize/route.ts`, `lib/pbv/form-generation/source-pdfs.ts`, new test(s); (only iff the SQL-function path is taken) one migration (commit-only).
**Acceptance criteria:**
- The idempotency lookup is scoped by `application_id` (same key+endpoint, different application → no cache hit).
- Finalize commits `submitted_at` and the `application_events` record atomically (or event-first-then-submit with 500 on event failure) — never submitted-without-event.
- `tryLoadPdf` returns null silently on `ENOENT` but logs an **error** with context on any other failure.

## Context (self-contained)
`lib/idempotency.ts` filters the cached-response lookup by `(key, endpoint)` only; the table has `application_id` but it's never read in the WHERE, so a guessable/shared key could replay another tenant's cached response. `finalize/route.ts` updates `submitted_at` then writes the audit event in a `try/catch` that only logs — a failed event write leaves the app submitted with no submission event. `tryLoadPdf` catches all errors and returns null, so a real FS failure (permission/EMFILE) is indistinguishable from an intentionally-unshipped PDF.

## Problem
- **#9:** idempotency lookup not scoped by `application_id` (cross-tenant replay).
- **#10:** finalize event write non-atomic.
- **#13:** `tryLoadPdf` swallows real errors.

## Goals
1. **#9:** add `.eq('application_id', applicationId)` to the lookup WHERE; thread `applicationId` from call sites if needed. No migration.
2. **#10:** make finalize atomic — **prefer** folding the `application_events` write into `finalize_pbv_application` (one transaction); **fallback** write the event before `submitted_at` and 500 on failure.
3. **#13:** in `tryLoadPdf`, branch on the error: `ENOENT` → null silently; else log error with form/file context, still return null.

## Non-goals
- Do **not** re-do the clock fix or any already-closed workflow item. No new idempotency column (#9 uses the existing `application_id`). No retry/queue for the finalize event beyond atomicity. Do not edit files outside the Outputs list.

## Implementation
1. Scope the idempotency lookup by `application_id` (thread it where missing).
2. Atomic finalize (SQL-function preferred; else event-first + 500). If SQL path, write the migration commit-only.
3. Error-code branch in `tryLoadPdf`.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run lib/__tests__/idempotency* lib/pbv/form-generation/__tests__/source-pdfs*` (+ finalize test if unit-testable) — same key+endpoint, different `application_id` → no cache hit; `tryLoadPdf` logs error on non-ENOENT, silent on ENOENT; finalize atomic (or event-first + 500).
- **No full build per PRP** unless the SQL-fn path changes a typed RPC signature (then build).
- **Deferred runtime gates:** apply any #10 migration on a preview; finalize commits both; simulated event failure → app stays unsubmitted; make a source PDF unreadable → an error log appears (not a silent skip).

**Default for ambiguity:** #10 prefers the SQL-function atomic write; if risky to change in-session, fall back to event-first reorder. Any migration is commit-only and recorded as migration-to-apply.
