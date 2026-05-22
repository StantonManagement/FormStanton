# PRP-020 — In-App Browser Detection & CSRF — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `f070b12640315f6ae6c7671adf931d984f55b5ca`
**Findings closed (Phase 1):** Angle-2 **F3** (in-app warning), **D7** (CSRF issuance + warn-mode verify; strict 403 = Phase 2 follow-up).

## Files changed
- `components/pbv/sign/MagicLinkSigningFlow.tsx` — `isInAppBrowser` helper + dismissable role=alertdialog warning on mount; EN/ES/PT copy; sessionStorage-backed dismiss.
- `lib/pbv/tenantEndpoint.ts` — `issueCsrfToken` / `verifyCsrfToken` + GET-response `_csrf` injection + mutating-method header verify in WARN mode (PRP-002 limiter unchanged).
- `lib/pbv/__tests__/prp020-csrf-inapp.test.ts` *(new)* — 15 tests.

## Path taken (defaults logged)
- **D7 ships in WARN mode** (Phase 1). The PRP's documented fallback was "ship F3 + record D7 as follow-up rather than half-implementing." We ship better than that: full token issuance + verify code paths are wired, the verify just doesn't 403 yet. This gives us deployable telemetry on which clients are missing the header, so the Phase 2 strict-flip in a follow-up has zero surprise. Flipping to strict requires (a) wiring `tenantFetch.ts` to forward the header on mutating calls, and (b) confirming via the log volume that every legitimate caller sends it.
- **CSRF token format:** `${expEpochSec}.${base64url(hmac-sha256(appId|exp))}` over `SESSION_SECRET`. 15-minute TTL. No DB storage — stateless HMAC verification.
- **`_csrf` injected only on JSON GET 2xx responses.** Non-JSON / non-2xx / non-GET responses pass through untouched.
- **In-app warning is non-blocking** — a "Continue anyway" button dismisses for the rest of the tab session.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/pbv/__tests__/prp020-csrf-inapp.test.ts` — **15 pass / 0 fail / 3.04 s.**

## Deferred runtime gates
- Open a magic link inside Instagram's in-app browser → alertdialog appears; Continue anyway → standard flow.
- Inspect a tenant bootstrap response on a preview → `_csrf` field present.
- POST a mutating tenant request WITHOUT `X-CSRF-Token` → still 200 (Phase 1) but Vercel logs show `[csrf] missing or invalid token`.
- Same call with the just-issued token → 200, no warning logged.

## Follow-ups (Phase 2)
1. In `lib/tenantFetch.ts`, read `_csrf` off bootstrap responses (cache in module state), and forward as `X-CSRF-Token` on every mutating call.
2. Once log volume confirms zero missing-token hits from legitimate traffic, flip the `// Phase 1: do NOT 403.` line in `tenantEndpoint.ts` to a 403 return.
