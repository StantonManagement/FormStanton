# PRP-020 — In-App Browser Detection & CSRF Defense-in-Depth

**Assigned batch (per BATCH_PLAN.md):** 05
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **F3** (Medium, in-app browser), **D7** (Medium, CSRF).
**Depends on:** **PRP-002** — that PRP wires a rate limiter into `lib/pbv/tenantEndpoint.ts`. This PRP adds CSRF issuance/verification to the **same file**. PRP-002 is in Batch 01 (runs before Batch 05), so layer the CSRF logic on PRP-002's version; **do not remove the limiter.** (Batches 01 and 05 must not run in parallel — they share `tenantEndpoint.ts`.)
**Inputs (read before editing):** `lib/pbv/tenantEndpoint.ts` (the bootstrap GET response + the mutating-POST path), the signer/magic-link flow entry component (the page a tenant lands on from a magic link), and how the tenant bootstrap response is shaped (to attach a CSRF token).
**Outputs (write — the ONLY files this PRP may modify/create):** the signer/magic-link flow entry component, `lib/pbv/tenantEndpoint.ts` (CSRF issuance/verify), new test(s).
**Acceptance criteria:**
- In-app browsers (Instagram/Facebook/LinkedIn webviews) are detected and the user is prompted to open the link in their default browser.
- The tenant bootstrap GET issues a short-lived CSRF token; mutating tenant POSTs require and verify it; missing/invalid → 403. Valid requests are unaffected.

## Context (self-contained)
Magic links opened inside Instagram/Facebook/Mail in-app browsers often strip cookies, use odd user agents, and may lack `localStorage`/`sessionStorage`, breaking the signer flow — with no detection or warning today. Separately, tenant mutating POSTs rely only on the URL token for CSRF protection; that token can leak via `Referrer` to third-party sites, so a defense-in-depth CSRF token is warranted. `withTenantContext` (in `tenantEndpoint.ts`) is the central tenant wrapper and already (per the prior batch) hosts a rate limiter — add CSRF here too, after the limiter.

## Problem
- **F3:** no in-app browser detection/warning.
- **D7:** no CSRF token on mutating tenant POSTs (URL-token-only).

## Goals
1. **F3:** a lightweight UA check (`Instagram`, `FBAV`, `LinkedIn`, etc.) on the signer/magic-link entry; if detected, show "Open in your default browser for the best experience" with guidance. Non-blocking (informational).
2. **D7:** the bootstrap GET response carries a short-lived CSRF token (e.g. signed/HMAC or a stored nonce); mutating tenant POSTs must include it (header or body) and `withTenantContext` verifies it (403 on missing/invalid). Confirm the token-issuance/verify approach fits the existing session/storage model before building.

## Non-goals
- No hard block of in-app browsers (warn only). No CSRF on GETs. No new auth system — a minimal token mechanism layered on the existing flow. Do not remove the rate limiter. Do not edit files outside the Outputs list.

## Implementation
1. In-app browser UA detection + prompt on the signer entry.
2. CSRF token issuance in the bootstrap GET + verification in the mutating-POST path of `withTenantContext` (after the limiter).

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` — known in-app UA → prompt shown, normal UA → not; a mutating POST without a valid CSRF token → 403, with a valid token → proceeds; the rate limiter still fires (not removed).
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** open a magic link inside Instagram's webview → prompt appears; a forged cross-site POST without the CSRF token → 403.

**Default for ambiguity:** if a robust CSRF mechanism can't be safely fit in-session, ship F3 (in-app detection) and record D7's design as a follow-up rather than half-implementing token verification.
