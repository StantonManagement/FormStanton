# PRD-19 — PBV Tenant Resilience (Timeout, Retry, Idempotency, Errors)

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Correctness / mobile UX
**Sequence:** Spawned from PRD-14 Phase 7.
**Depends on:** PRD-15 (finalize endpoint exists and needs the idempotency-key option). PRD-16 (API consolidation; cleaner to retrofit `tenantFetch` against one tree).
**Blocks:** Nothing strictly, but PRD-21 (E2E tests) is much easier with deterministic error states.

---

## Problem Statement

The tenant page makes bare `fetch()` calls with no timeout, no retry, no idempotency, and inconsistent error UI. Real mobile networks fail. Symptoms:

1. **Network hiccup mid-upload** → silent fail or spinning loader, no error message, no retry path.
2. **Tenant hits "Submit" twice on a slow network** → two intake POSTs race, the second returns 409 "already submitted," tenant sees a confusing error for what was actually a successful submission.
3. **Finalize POST times out** → tenant doesn't know if it succeeded; reloads, sees the application is locked, panics.
4. **Document upload returns 500** → no retry button, no clear error, just a stuck state.

This PRD adds a `tenantFetch` wrapper with timeout, one automatic retry on transient network errors, and idempotency-key generation. Adds a `tenant_idempotency_keys` table for server-side replay safety. Replaces every bare `fetch()` in tenant pages. Adds user-visible error states with manual retry buttons.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| Bare `fetch()` calls in `TenantDocumentUpload.tsx` and `page.tsx` with no timeout/retry | Grep | Verified |
| Intake POST returns generic 409 on retry | Read PRD-14 audit | Verified |
| No `tenant_idempotency_keys` table or any equivalent | [Unverified] — confirm before migration | Verify |

---

## Key decisions

### 1. `tenantFetch(url, opts)` is the only fetch path in tenant code

After this PRD lands, grep `fetch(` in tenant pages/components returns only `tenantFetch` usages. No exceptions.

### 2. Per-call timeouts

15 seconds for reads (GET, light POST). 60 seconds for uploads (document upload, signature image save if large). One retry on network error (no response, ECONNRESET, ETIMEDOUT). No retry on 4xx — those are deterministic client errors.

### 3. Idempotency keys on every tenant write

Client generates a UUIDv4 per logical action (one intake submission attempt, one upload attempt, one finalize attempt, one signature save batch). Sends as `Idempotency-Key` header. Server stores key → response in `tenant_idempotency_keys`. Replays return the stored response, NOT a fresh 409.

### 4. Errors are always user-visible

No silent failures. Every fetch error → an error state in the UI with a clear localized message and a retry button. Spinner + no error after 15s = error state, period.

### 5. Idempotency is per-application, not global

Keys are scoped to `(application_id, endpoint, key)`. Cross-application replay is not a concern; cross-endpoint replay is also not a concern. A key for the intake POST and a key for the finalize POST are independent.

---

## Scope

### What this PRD does

1. Adds `tenant_idempotency_keys` table (key + endpoint + application_id + response_body + response_status + created_at + expires_at).
2. Builds `lib/tenantFetch.ts` with timeout, network retry, idempotency-key generation/passthrough.
3. Builds `lib/idempotency.ts` server-side helper for checking + storing idempotency-key results.
4. Wires idempotency checks into: intake POST, document upload, signature save, finalize.
5. Replaces every bare `fetch()` in `app/pbv-full-app/[token]/page.tsx` and `components/pbv/TenantDocumentUpload.tsx` with `tenantFetch`.
6. Adds error UI with retry buttons for: documents fetch, document upload, signature save, finalize.
7. Adds key expiration (e.g., 24h) and a cleanup job (Supabase cron or a route called nightly).

### What this PRD does NOT do

- Add idempotency to admin endpoints.
- Add a global request-tracing system.
- Persist client-generated keys to localStorage (the key lives in memory for one in-flight action; reload generates a new one — which is correct behavior).

---

## Affected files

### New migration

| File | What |
|---|---|
| `supabase/migrations/20260514230000_tenant_idempotency_keys.sql` | `CREATE TABLE tenant_idempotency_keys (key TEXT NOT NULL, endpoint TEXT NOT NULL, application_id UUID NOT NULL REFERENCES pbv_full_applications(id), response_body JSONB NOT NULL, response_status INT NOT NULL, created_at TIMESTAMPTZ DEFAULT now(), expires_at TIMESTAMPTZ DEFAULT now() + interval '24 hours', PRIMARY KEY (key, endpoint))`. Index on `expires_at`. |

### New libraries

| File | What |
|---|---|
| `lib/tenantFetch.ts` | `tenantFetch(url, opts)`. Generates `Idempotency-Key` for POST/PUT/PATCH/DELETE (UUIDv4 per call). Applies timeout via `AbortController`. One retry on network error (not HTTP error). Normalized error envelope. |
| `lib/idempotency.ts` | `withIdempotency(request, applicationId, endpoint, handler)` server-side wrapper. Checks the table for an existing key; returns stored response if present; runs handler and stores result if absent. |

### Modified API routes

| Route | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/route.ts` POST (intake) | Wrap handler in `withIdempotency`. |
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | Wrap handler in `withIdempotency`. (Existing replay-via-submitted_at logic still works; idempotency table just makes it explicit.) |
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | Wrap handler in `withIdempotency`. |
| `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` | Wrap handler in `withIdempotency`. |

### Modified client files

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` | Replace every bare `fetch()` with `tenantFetch()`. Add error states with retry buttons for: load failure, intake submission failure, signature save failure, finalize failure. Localized error strings. |
| `components/pbv/TenantDocumentUpload.tsx` | Replace bare `fetch()` with `tenantFetch()`. Add error state with retry button for documents list fetch and upload failures. |

### New scheduled task (optional)

| File | What |
|---|---|
| `app/api/cron/cleanup-idempotency-keys/route.ts` | DELETE FROM tenant_idempotency_keys WHERE expires_at < now(). Called by Supabase cron or external scheduler nightly. |

---

## Phases

### Phase 1 — Migration + idempotency helpers

| # | Step | Verify |
|---|---|---|
| 1.1 | Apply `20260514230000_tenant_idempotency_keys.sql`. | Table exists, indexes correct. |
| 1.2 | Build `lib/idempotency.ts` `withIdempotency()` helper. Unit tests for: first-write storage, replay returns stored response, expired key is ignored. | Tests pass. |

### Phase 2 — `tenantFetch` library

| # | Step | Verify |
|---|---|---|
| 2.1 | Build `lib/tenantFetch.ts`. Unit tests for: timeout, retry on network error, no retry on 4xx, idempotency-key generation, error envelope shape. | Tests pass. |

### Phase 3 — Wire idempotency into endpoints

| # | Step | Verify |
|---|---|---|
| 3.1 | Wrap each tenant write endpoint in `withIdempotency`. | Replay test against each endpoint: same key returns same body and status; different key on the same payload produces fresh processing. |
| 3.2 | Confirm PRD-15 finalize endpoint's replay-via-submitted_at still works correctly under idempotency wrapping. | Finalize twice: same key → same response; new key on finalized app → still returns the existing `submitted_at`. |

### Phase 4 — Client retrofit

| # | Step | Verify |
|---|---|---|
| 4.1 | Replace every bare `fetch()` in tenant files with `tenantFetch()`. | Grep audit: `fetch(` in tenant files returns only `tenantFetch`. |
| 4.2 | Add error states with retry buttons to every fetch site. Localize error strings. | Manual test: kill backend, trigger each action; error UI shows with retry button. Retry succeeds when backend returns. |

### Phase 5 — Cleanup job

| # | Step | Verify |
|---|---|---|
| 5.1 | Implement the cleanup route (or document a manual SQL cleanup if cron isn't set up). | Cron runs; expired rows deleted. |

### Phase 6 — Verification

| # | Step | Verify |
|---|---|---|
| 6.1 | Chaos test: kill backend mid-action for each action type. UI shows error + retry; retry works when backend returns. | Pass. |
| 6.2 | Replay test: submit each tenant write twice with same key. Second returns stored response. | Pass. |
| 6.3 | Network timeout test: simulate a 30s response delay; client times out at 15s (60s for uploads); error UI shows; retry succeeds. | Pass. |
| 6.4 | Build / lint / type-check clean. | Pass. |

---

## Rollback

- Migration additive; drop table to inverse.
- `tenantFetch` reverts to `fetch` via revert.
- `withIdempotency` wrappers can be removed; underlying handler logic is unchanged.
- Error UI states are pure additions.

---

## Open questions

1. **[Speculation]** Whether 15s read timeout is right for the slowest mobile network the tenant might use. If staff testing reveals legitimate timeouts, raise to 30s — but never higher without re-thinking the UX.
2. **[Unverified]** Whether the document upload endpoint is currently capable of running long enough for 60s timeouts. Confirm body parsing settings.
3. **[Speculation]** Whether to also persist idempotency keys for GET requests (for the loading-state stability case). Recommendation: no. GETs are safe to retry; idempotency keys add cost for no gain.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Idempotency at the wrapper level, not per-endpoint | Consistency. Every tenant write should be replay-safe; manual per-endpoint implementation invites drift. |
| 2026-05-14 | Keys expire at 24h | Long enough for "finalize on tomorrow's session"; short enough that the table doesn't grow unbounded. |
| 2026-05-14 | One retry, not exponential backoff | Mobile networks usually recover or stay dead. A second retry adds latency without improving success rate meaningfully. |
| 2026-05-14 | No client-side localStorage of keys | A reload is a new logical action. Persisting keys across reloads invites "I clicked submit yesterday and now my submission is replayed" footguns. |
