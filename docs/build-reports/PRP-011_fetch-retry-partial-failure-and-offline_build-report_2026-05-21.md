# PRP-011 — tenantFetch Backoff, Partial-Failure & Offline — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `a3186bfef25406ba20f5011f0c5b55de439d3d2d`
**Findings:** Angle-2 **C2** (backoff), **C3** (partial failure), **C4** (offline primitive), **E3** (idempotency-key honored).

## Files changed
- `lib/tenantFetch.ts` — full rewrite of the retry/idempotency logic; backoff schedule + retryable-status set + caller-supplied key honored.
- `lib/pbv/hooks/useDashboardState.ts` — `Promise.allSettled` + per-slice `DashboardSliceStatus`. `slices` field is **optional** on the ready state so existing type predicates (e.g. `stepGates.ts:14`) keep compiling.
- `lib/pbv/context/OnlineStatusProvider.tsx` *(new)* — provider + `useOnlineStatus` hook.
- `lib/__tests__/tenantFetch.test.ts` — rewrote to match new semantics (15 tests).
- `lib/pbv/hooks/__tests__/useDashboardState.test.ts` *(new)* — 4 tests with `@vitest-environment jsdom` pragma.
- `components/pbv/context/__tests__/OnlineStatusProvider.test.tsx` *(new)* — 4 tests. **Located under `components/`** (not under `lib/`) because the vitest `include` glob only matches `.test.tsx` under `components/`; out-of-scope to edit `vitest.config.ts` for this PRP.

## Path taken (defaults logged)
- **Retry semantics:** unified the "send key" and "retry eligible" predicates. A non-GET method without `idempotent: false` carries an Idempotency-Key (default behavior) AND is retry-eligible — because server-side dedup makes the retry safe. `idempotent: false` is the explicit opt-out for endpoints that must not repeat.
- **Internal timeout is transient.** The original wrapper bailed on `AbortError`; the new wrapper treats it as a candidate for retry because most timeouts are network-side and reattempt is the right move. External caller `signal.aborted` is preserved as fatal.
- **Slices field is optional.** Required-shape broke `stepGates.ts` (out of Outputs). Optional is backward-compat for existing narrowed reads.
- **No layout mount yet.** The PRP says "mount at the tenant layout" but the layout is not in Outputs. The provider exists and `useOnlineStatus` returns `true` when unmounted; mount-in-layout + dashboard banner UI are a follow-up.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/__tests__/tenantFetch.test.ts lib/pbv/hooks/__tests__/useDashboardState.test.ts components/pbv/context/__tests__/OnlineStatusProvider.test.tsx` — **23 pass / 0 fail / 6.33 s.**

## Deferred runtime gates
- DevTools network → throttle "Slow 3G" then "Offline" → dashboard renders + recovers; one failing slice's card shows the inline warning + retry; offline → banner shown + submit disabled (after the follow-up wires the banner).
- Verify on a preview that backoff doesn't pile up parallel requests on a real slow network.

## Follow-ups (post-PRP-011)
1. **Mount `OnlineStatusProvider`** in `app/pbv-full-app/[token]/layout.tsx` (additive — wraps `children`).
2. **Wire the dashboard banner**: in `app/pbv-full-app/[token]/dashboard/page.tsx`, call `useOnlineStatus()` and render an offline banner + disable the submit CTA when offline.
3. **Dashboard inline warning** for `state.slices.forms === 'failed'` (etc.) with a "retry this card" button. Trivial since `slices` is already exposed.

These three are ~30 LOC each and complete the C4 / C3 fix UI-side. Out of scope here because the layout + dashboard files are not in PRP-011's Outputs.
