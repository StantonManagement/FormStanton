# PRD-15 — PBV Submission Lock & Tenant Resilience

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Correctness / production readiness
**Parent vision doc:** `docs/14-pbv-tenant-flow-go-live-fixes_prd_2026-05-14.md` (this PRD owns Phases 2, 6 partial, 7, 8 of PRD-14)
**Sibling PRDs:** PRD-16 (surface consolidation), PRD-17 (rejection loop), PRD-18 (E2E coverage)
**Goal:** A PBV full application's "submitted" state is a server-persisted invariant. Tenants on flaky mobile networks complete the flow without duplicate submissions, lost work, or silent failures. Returning tenants land on a read-only confirmation.

---

## Problem Statement

The tenant flow's `confirmed` state is unreachable — `setPageState('confirmed')` is never called. After the last signer finishes, the tenant gets bounced to `docs_ready` indefinitely and can reload to re-sign. There is no atomic finalize endpoint; "submitted" is a derived computation, not a persisted column. Every tenant write is a bare `fetch()` with no timeout, no retry, no idempotency key — a typical mobile network blip creates duplicate submissions or silent failure. The multi-signer canvas handoff at `page.tsx:658` calls `sigCanvasRefs.current.clear()` on the Map itself (not its contents), which may strand canvas state between adult signers. No `already_submitted` state — a returning tenant who completed yesterday can re-enter and mutate the application.

This PRD makes "submitted" a server-side fact, makes every tenant write idempotent and resilient, and gives returning tenants a read-only confirmation.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| `setPageState('confirmed')` is never called | Grep across full repo — zero matches | Verified |
| Main page `pageState === 'signatures'` (lines 1435-1484) renders working `react-signature-canvas` per-doc | Read source | Verified |
| Last-signer-done handler at `page.tsx:1384` sets `pageState='docs_ready'` (not `'confirmed'`) | Read source | Verified |
| `sigCanvasRefs.current.clear()` at `page.tsx:658` clears the Map but not individual canvases | Read source | Verified |
| No `pbv_full_applications.submitted_at` column today | [Unverified] — confirm before migration | Open |
| No `/api/t/[token]/pbv-full-app/finalize` endpoint exists | Glob | Verified |
| All tenant `fetch()` calls are bare (no timeout, retry, idempotency) | Grep of tenant files | Verified |
| Intake POST returns 409 "Application intake already submitted" on retry (no idempotency-key replay) | Read `app/api/t/[token]/pbv-full-app/route.ts:230-235` | Verified |

---

## Key decisions

### 1. `submitted_at` is the lock

A `pbv_full_applications.submitted_at TIMESTAMPTZ` column is the single source of truth for "this application is locked." All mutation endpoints (intake, document upload, signature save, finalize) reject writes when this column is non-null. The client `confirmed` and `already_submitted` page states gate on it.

### 2. Idempotency at every tenant write

A `tenant_idempotency_keys` table stores `(key, endpoint, application_id, response_body, response_status)`. Every tenant POST accepts an `Idempotency-Key: <uuid>` header; replays return the stored response with the original status code. New keys for the same logical action produce new responses. Distinct actions get distinct UUIDs generated client-side per logical interaction.

### 3. One `lib/tenantFetch.ts` wrapper, no exceptions

All bare `fetch()` in tenant files are migrated. The wrapper enforces: 15s read timeout, 60s upload timeout, one network-error retry with exponential backoff (1s), Idempotency-Key generation/passthrough, normalized `{ ok, data, error }` envelope. Errors throw typed `TenantFetchError` with discriminated kind: `'timeout' | 'network' | 'server' | 'validation' | 'conflict'`. No silent failures.

### 4. Finalize is transactional

The finalize endpoint validates completion (all required docs in `submitted | approved | waived`, all required signatures saved for every adult signer) inside the same DB transaction that writes `submitted_at`. Validation failure returns 409 with `{ missing: { documents: [...], signatures: [...] } }`. Replays of the same idempotency key return the stored response (success or 409) without re-validating.

### 5. Multi-signer canvas handoff fix

`sigCanvasRefs.current.forEach(c => c?.clear()); sigCanvasRefs.current.clear()`. Iterate first, then reset the Map. Confirms with a 2-adult walkthrough.

### 6. Signature review preview step

Before the finalize POST fires, the tenant sees a preview page listing each saved signature (thumbnail + signer name + document label) with a "re-sign" option per row. Once they confirm, finalize POSTs and the application locks. Post-finalize, no re-sign is possible.

### 7. `already_submitted` is a real read-only render

Not a placeholder. Shows: `submitted_at` timestamp localized to the tenant's language, full document checklist with statuses (read-only), signatures list (read-only), "contact the office to make changes" CTA. Server-side mutation guard ensures direct API hits to upload/signature endpoints also reject when locked.

---

## Scope

### What this PRD does

1. Adds `pbv_full_applications.submitted_at TIMESTAMPTZ` and `pbv_full_applications.finalized_idempotency_key TEXT UNIQUE`.
2. Creates `tenant_idempotency_keys` table.
3. Builds `lib/tenantFetch.ts` with timeout, retry, idempotency, typed errors.
4. Builds `POST /api/t/[token]/pbv-full-app/finalize` endpoint.
5. Adds server-side mutation guard to all tenant write endpoints: reject when `submitted_at IS NOT NULL`.
6. Wires `setPageState('confirmed')` after finalize success.
7. Wires `setPageState('already_submitted')` on load when `submitted_at IS NOT NULL`.
8. Fixes `sigCanvasRefs.current.clear()` at `page.tsx:658`.
9. Adds signature review preview step before finalize POST.
10. Builds real `already_submitted` render block with localized strings.
11. Migrates all bare `fetch()` in `app/pbv-full-app/`, `components/pbv/`, and tenant components to `tenantFetch`.
12. Adds user-visible error UI with retry buttons for: documents fetch, document upload, signature save, finalize.
13. Adds idempotency-key generation client-side per logical action.

### What this PRD does NOT do

- Touch document categorization (PRD-14 Phase 4 / running).
- Remove orphan signing surface or consolidate API trees (PRD-16).
- Touch rejection-reason templates or `application_events` per-signer logging (PRD-17).
- Add E2E tests (PRD-18).
- Modify admin review flows.

---

## Affected files

### New migrations

| File | What |
|---|---|
| `supabase/migrations/20260514210000_pbv_submitted_at.sql` | ADD `submitted_at TIMESTAMPTZ`, `finalized_idempotency_key TEXT UNIQUE` to `pbv_full_applications`. Optional backfill of `submitted_at` for applications whose current computed state is "complete" — gate this behind a one-shot SQL block reviewed by Alex before applying. |
| `supabase/migrations/20260514211000_tenant_idempotency_keys.sql` | CREATE TABLE `tenant_idempotency_keys (key TEXT PRIMARY KEY, endpoint TEXT NOT NULL, application_id UUID NOT NULL REFERENCES pbv_full_applications(id), response_body JSONB NOT NULL, response_status INT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`. Index `(application_id, endpoint)`. RLS service_role-only. |

### New routes

| Route | Method | Purpose |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | POST | Validate completion, write `submitted_at`, idempotent. |

### Modified routes (mutation guard + idempotency)

| Route | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/route.ts` POST | Reject when `submitted_at IS NOT NULL`. Honor `Idempotency-Key` header. |
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` POST | Reject when `submitted_at IS NOT NULL`. Honor `Idempotency-Key`. |
| `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` POST (or the consolidated route per PRD-16) | Reject when `submitted_at IS NOT NULL`. Honor `Idempotency-Key`. |
| `app/api/t/[token]/pbv-full-app/route.ts` GET | Include `submitted_at` in response. |

### New library files

| File | What |
|---|---|
| `lib/tenantFetch.ts` | `tenantFetch<T>(url, opts): Promise<{ ok: true, data: T } \| { ok: false, error: TenantFetchError }>`. Options: `timeout` (ms, default 15000), `retry` (boolean, default true for GET/idempotent POST), `idempotencyKey` (string, auto-generated if omitted on writes). Uses `AbortController` for timeout. One retry on network error with 1s backoff. |
| `lib/idempotencyMiddleware.ts` | Server-side helper: `withIdempotency(req, applicationId, endpoint, handler)`. Looks up `tenant_idempotency_keys`, returns cached response if present, otherwise runs handler and caches result. |

### Modified client files

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` | (a) `setPageState('confirmed')` after finalize POST success. (b) `setPageState('already_submitted')` in load handler when `submitted_at IS NOT NULL`. (c) Fix `sigCanvasRefs.current.clear()` at line 658. (d) Add signature review preview step between `signatures` complete and finalize POST. (e) Replace placeholder `already_submitted` render (lines 690-707) with real read-only confirmation. (f) Replace all `fetch()` with `tenantFetch()`. (g) Generate idempotency key per submission/signature/finalize. (h) Add error states with retry buttons for each phase. |
| `components/pbv/TenantDocumentUpload.tsx` | (a) Use `tenantFetch` for documents fetch and upload. (b) Pass idempotency key on upload POST. (c) Surface error UI with retry button. |

---

## Phases

### Phase 1 — DB substrate

| # | Step | Verify |
|---|---|---|
| 1.1 | Apply `20260514210000_pbv_submitted_at.sql`. Columns added, no data corruption. | `select column_name from information_schema.columns where table_name='pbv_full_applications' and column_name in ('submitted_at','finalized_idempotency_key')` returns 2 rows. |
| 1.2 | Apply `20260514211000_tenant_idempotency_keys.sql`. Table + index + RLS in place. | Table exists; service_role can write; anon cannot. |
| 1.3 | Optional backfill decision: query existing applications whose computed state is "complete" and propose a one-shot UPDATE to set `submitted_at`. Post the proposed UPDATE in chat for Alex's sign-off before applying. | No backfill applied without sign-off. |

### Phase 2 — Server-side foundation

| # | Step | Verify |
|---|---|---|
| 2.1 | Build `lib/idempotencyMiddleware.ts`. Unit tests: replay returns cached response, distinct keys produce distinct responses, malformed key returns 400. | Tests pass. |
| 2.2 | Build `POST /api/t/[token]/pbv-full-app/finalize`. Inside one DB transaction: validate all required docs in `(submitted, approved, waived)`, validate all required signatures saved per adult signer, write `submitted_at = now()` and `finalized_idempotency_key = <key>`, write `application_events` row for `application_finalized`. Wrap in `withIdempotency`. | Unit + integration tests: happy path, replay, validation failure with explicit `missing` list. |
| 2.3 | Add server-side mutation guard to intake POST, signatures POST, documents upload POST: query `submitted_at`, reject 409 if non-null with `{ code: 'application_locked', submitted_at }`. | Curl after finalize against each endpoint returns 409. |
| 2.4 | Add `Idempotency-Key` header support to intake POST, signatures POST, documents upload POST. Wrap each in `withIdempotency`. | Replay tests pass for each endpoint. |
| 2.5 | GET `/api/t/[token]/pbv-full-app` includes `submitted_at` in response. | Manual GET shows the field. |

### Phase 3 — Client foundation (`lib/tenantFetch`)

| # | Step | Verify |
|---|---|---|
| 3.1 | Build `lib/tenantFetch.ts`. Unit tests for timeout, network retry, idempotency key generation, typed error envelope. | Tests pass. |
| 3.2 | Migrate `components/pbv/TenantDocumentUpload.tsx` `fetch()` calls to `tenantFetch`. Add error UI with retry button on documents fetch failure and upload failure. | Manual: kill backend mid-upload; UI shows error + retry; retry succeeds when backend returns. |
| 3.3 | Migrate `app/pbv-full-app/[token]/page.tsx` `fetch()` calls to `tenantFetch`. Add error UI with retry for each phase's failures (intake submit, signing data load, signatures save, finalize). | Grep for `fetch(` in tenant files returns only `tenantFetch` usages. |

### Phase 4 — Multi-signer canvas fix + signature review

| # | Step | Verify |
|---|---|---|
| 4.1 | Fix `sigCanvasRefs.current.clear()` at `page.tsx:658`: `sigCanvasRefs.current.forEach(c => c?.clear()); sigCanvasRefs.current.clear()`. Apply the same fix at line 618 if present. | Manual: 2-adult walkthrough; second signer's canvases render blank and are responsive. |
| 4.2 | Add signature review preview step: new sub-state `signerStep === 'review'` between `signing` and `done`. Renders saved signature thumbnails per doc, "re-sign" button per row, "submit application" button at bottom. "Submit application" fires the finalize POST. | Manual: tenant sees preview; can re-sign before locking; once locked, preview shows the saved state read-only. |

### Phase 5 — Confirmed and already_submitted states

| # | Step | Verify |
|---|---|---|
| 5.1 | Wire `setPageState('confirmed')` in finalize success handler. On finalize failure (network or 409 validation), render error UI with retry. | E2E walkthrough ends on `SuccessScreen`. |
| 5.2 | Wire `setPageState('already_submitted')` in load handler when GET response includes non-null `submitted_at`. | Finalize a test app, reload — does not return to mutation state. |
| 5.3 | Build real `already_submitted` render block at `page.tsx` lines 690-707: timestamp + read-only doc checklist + signatures list + contact CTA. Localized in en/es/pt. | Manual: confirm render in all three languages. |
| 5.4 | Verify server-side guard prevents writes after finalize: direct curl POST to each mutation endpoint returns 409. | Test pass. |

---

## Verification

### Definition of done

- A tenant who completes the flow sees a real `confirmed` success screen.
- That same tenant reloading the page lands on `already_submitted` with no mutation path.
- A tenant on a flaky network retrying a submission via the in-page retry button does NOT create duplicate intakes, signatures, or document uploads.
- A tenant whose tab crashes mid-signature can recover by reloading and re-signing — but cannot accidentally re-sign after finalize.
- 2-adult households complete signing without canvas state bleeding between signers.
- Direct API calls to mutation endpoints after finalize return 409.
- Grep for bare `fetch(` in tenant files returns zero hits outside `tenantFetch`.

---

## Rollback

| Phase | Rollback |
|---|---|
| 1 | Additive migrations. Drop columns/table if reverting. |
| 2 | `git revert` server changes. Columns remain harmless if unused. Idempotency table is harmless if no longer written to. |
| 3 | Revert client commits; `tenantFetch` is purely additive — old `fetch` reinstatement is clean. |
| 4 | Canvas refs fix is one-line. Signature review preview is a single state-machine change — revert as one commit. |
| 5 | Confirmed/already_submitted wiring reverts cleanly; if reverted, tenants see the prior behavior (bounce to docs_ready). |

---

## Open questions

1. **[Unverified]** Does `pbv_full_applications` already have any "submitted-like" column we should reuse rather than adding `submitted_at`? Read the schema before applying Phase 1.1.
2. **[Unverified]** Is there an existing `application_events` event_type for "application_finalized" or do we need a new enum value / event_type string? Confirm before Phase 2.2.
3. **[Inference]** Backfill of `submitted_at` for historical applications uses the existing `next_step === 'complete'` computation as predicate. Validate the predicate against current data with a SELECT before any UPDATE.
4. **[Speculation]** Whether `tenant_idempotency_keys` needs a TTL cleanup job. Probably yes (90-day retention to bound table size). Documented as a follow-up, not in this PRD's scope.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | `submitted_at` is a column, not a derived flag | Server-persisted invariant eliminates the entire class of "tenant reloaded and re-signed" bugs. |
| 2026-05-14 | Idempotency keys generated client-side per logical action | Single source of truth; server is a passive store-and-replay. Avoids ambiguous "what counts as a duplicate" debates. |
| 2026-05-14 | `tenantFetch` is mandatory; no escape hatch | The bug pattern across the audit was silent failure. Forcing a typed-error envelope and explicit retry makes failures visible. |
| 2026-05-14 | Signature review preview before finalize | Last-mile usability: tenants sign on phones, sloppy signatures are common, no recovery after lock is a UX hole. |
| 2026-05-14 | No TTL on idempotency keys in this PRD | Out of scope; followup. Table will grow but reads stay fast with the index. |
