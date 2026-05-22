# PRP-011 — Fetch Retry, Partial-Failure Tolerance & Offline Awareness

**Assigned batch (per BATCH_PLAN.md):** 03
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **C2** (High), **C3** (High), **C4** (Medium), **E3** (Medium, `tenantFetch` side).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `lib/tenantFetch.ts` (~22–28 idempotency-key handling, ~53–60 retry), `lib/pbv/hooks/useDashboardState.ts` (~61–152, esp. the `Promise.all` ~66–71), and the tenant layout mount point.
**Outputs (write — the ONLY files this PRP may modify/create):** `lib/tenantFetch.ts`, `lib/pbv/hooks/useDashboardState.ts`, new `lib/pbv/context/OnlineStatusProvider.tsx` (+ a `useOnlineStatus` hook), new test(s).
**Acceptance criteria:**
- `tenantFetch` does exponential backoff (max 3) on network errors + retryable 5xx/timeout, **only for idempotent requests** (GETs always; POSTs only when a caller supplies an idempotency key); 4xx never retried.
- `tenantFetch` honors a caller-supplied `idempotencyKey` (else generates one).
- `useDashboardState` uses `Promise.allSettled` and renders partial data with an inline warning for the failed slice.
- An `OnlineStatusProvider` + `useOnlineStatus()` exists; the dashboard shows an offline banner.

## Context (self-contained)
`tenantFetch` retries once immediately on `TypeError` with no delay; the data hooks have no retry, so one network blip → a permanent error screen. `useDashboardState` fires four requests with `Promise.all`, so one failing slice (e.g. `upload-summary` 500) errors the whole dashboard. There's no offline awareness. Separately, `tenantFetch` ignores a caller-supplied idempotency key and generates its own, making a composed signing-ceremony key inert (the consumer side is fixed by a later PRP in this batch — see Depends-on note in that PRP).

## Problem
- **C2:** no robust retry. **C3:** dashboard fails-all-on-one. **C4:** no offline awareness. **E3:** idempotency key overwritten.

## Goals
1. **C2/E3:** exponential backoff (1s/2s/4s, max 3) on network + retryable 5xx/timeout for idempotent requests only (GETs always; POSTs only with a supplied key). Add an optional `idempotencyKey` param sent as the existing `Idempotency-Key` header when provided (confirm the header name before changing).
2. **C3:** `useDashboardState` → `Promise.allSettled`; expose per-slice status; render available cards + an inline warning + retry for the failed slice.
3. **C4:** `OnlineStatusProvider` listening to `online`/`offline` (default `navigator.onLine`); `useOnlineStatus()`; mount at the tenant layout (additive); dashboard offline banner.

## Non-goals
- No offline write *queue*. No retry on 4xx. No edits to `useSigningCeremony`/`useSectionAutoSave` (a sibling PRP owns those). Do not edit files outside the Outputs list.

## Implementation
1. Backoff + idempotency-key honoring in `tenantFetch`.
2. `allSettled` + partial render in `useDashboardState`.
3. `OnlineStatusProvider` + hook + dashboard banner.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run lib/__tests__/tenantFetch* lib/pbv/hooks/__tests__/useDashboardState*` — backoff retries then succeeds/gives up; 4xx not retried; a supplied `idempotencyKey` is sent verbatim; dashboard renders partial data on one rejection; `useOnlineStatus` flips on events.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** throttle/kill network → backoff + recovery; one failing dashboard slice → other cards render with inline warning; toggle offline → banner + submit disabled.
