# PRP-002 — Rate Limiting & Brute-Force Resistance — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `e89cb56ce735cb878ff3e441b153ed81b750c538`
**Findings closed (wired; protection contingent on adapter swap):** Angle-2 audit — **D2**, **D3**

## Files changed
- `lib/rateLimit.ts` *(new)* — `RateLimitAdapter` interface, memory adapter, `checkRateLimit`, `peekRateLimit`, `registerFailedAttempt`, `resolveTenantLimit`, `ipKeyFromHeaders`, `rateLimitedResponse`, signer constants.
- `lib/pbv/tenantEndpoint.ts` — limiter wired before DB lookup (per-token+route + per-IP backstop); existing 404/submitted/packet_locked gates preserved.
- `app/api/pbv-full-app/signer/[member_token]/route.ts` — per-IP entry limit + shared failure-counter lockout; generic-deny body so the response is not a token-validity oracle; failure registered on lookup-miss and expired-link.
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` — same per-IP + shared lockout pattern.
- `lib/__tests__/rateLimit.test.ts` *(new)* — 15 tests.

## Path taken
- **No shared store available.** Built behind `RateLimitAdapter` and shipped the in-memory adapter as the sole implementation. Startup `console.warn` calls out the single-instance limitation; OPEN-DECISIONS.md has the blocker entry. **The limiter is wired but does not protect against a distributed attacker until Upstash/KV lands.**
- **Lockout counter strategy:** in-store counter via `registerFailedAttempt`, not a DB column. Reversible — adding `failed_magic_link_attempts` is additive if forensic history is wanted.
- **Peek semantics:** added `peek` to the adapter so the lockout gate does not itself increment the failure counter (would otherwise double-count and lock legitimate users out early).
- **Tenant per-IP backstop:** 240/min — larger than the per-token limit because legitimate users on shared NAT (a single home/office IP) make many requests across multiple tabs/devices; the backstop only catches a single host hammering many tokens.
- **Generic deny body** for signer lockout (`{ code: 'invalid_or_expired' }`) so 404/410 distinctions don't act as a probe oracle once the IP is throttled.
- Signer bootstrap + sign-form share the **same failure-counter key** (`signer-bootstrap-fail:{ip}`) so probes across both endpoints share one failure budget.

## Migration
- **None.** PRP allowed a migration iff the lockout counter became a DB column; we used the in-store counter so no schema change shipped. Already noted in OPEN-DECISIONS.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/__tests__/rateLimit.test.ts` — **15 pass / 0 fail / 1.36 s.**
  - (Note: `node ./node_modules/.bin/vitest` does not work on Windows — the file is a bash shim. Logged in OPEN-DECISIONS for SHELL-PROTOCOL update.)

## Deferred runtime gates
- On a preview with the real shared store provisioned:
  - 25 rapid `sign-form` requests against one token in ≤10 s → ~20 succeed then 429s with `Retry-After`.
  - 15 invalid `member_token` requests from one IP → after the 10th failure subsequent requests return 429 with generic body (token validity unrecoverable).
  - `withTenantContext` denial under load preserves the original gate order (limiter denial reached before DB lookup).
- Confirm `x-vercel-forwarded-for` is present in production responses; if not, swap the IP source.

## Decisions logged
- `[PRP-002] Rate-limiter backend — BLOCKER` (Upstash provisioning).
- `[PRP-002] Signer lockout via counter, not DB column — DECISION`.
- `[SHELL-PROTOCOL] vitest direct-binary on Windows — DEFAULT`.
All three in `docs/fullApp-Plan/OPEN-DECISIONS.md`.
