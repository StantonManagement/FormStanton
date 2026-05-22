# PRD-84 — Observability & Path-Safety — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Commit SHA:** `09308fa`
**Audit source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` (A8, A9)

---

## What changed (files)

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/events/route.ts` | A8 | response data now carries `persistence_initiated: processedEvents.length`; writes remain non-blocking |
| `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts` | A9 | `.replace()` strip replaced with explicit `.startsWith()` + `.slice()`; `createSignedUrl` failures log `signature_thumbnail_signed_url_failed` and omit the entry instead of leaking a broken URL |
| `lib/pbv/__tests__/prd84-observability-and-path-safety.test.ts` | A8, A9 | new — Gates 1–3 |

## Path taken (preferred vs. fallback) + why

- **A8 — default (async + persistence_initiated count).** Per the PRD's default posture. The events route is analytics ingestion (per the file header — `client-side analytics event ingestion for the document card stack`). Awaiting the writes would add 50–100ms to the tenant's request path with no downstream consumer that needs confirmed persistence today. The new `persistence_initiated` count tells the client how many writes were dispatched (= `processedEvents.length`, i.e. accepted events that survived validation). A future change can flip to `await Promise.allSettled(...)` and report settled results if a downstream consumer ever needs confirmed persistence.
- **A9 — preferred (.startsWith() + .slice() + observable failure handling).** The pre-PRD-84 `.replace('pbv-applications/', '')` silently no-ops on non-matching paths and feeds the wrong path to `createSignedUrl`. The new strip is explicit on both branches (prefix present → slice; prefix absent → pass through deliberately) and `createSignedUrl` failures are logged via `console.warn(JSON.stringify({event: 'signature_thumbnail_signed_url_failed', ...}))` with the entry omitted from `urlMap` — so a broken URL is never surfaced as valid to the client.

## Static gates

- `node ./node_modules/typescript/bin/tsc --noEmit` → **clean** (no output).
- `npm run build` → **clean** (only pre-existing route warnings).
- `npx vitest run lib/pbv/__tests__/prd84-observability-and-path-safety.test.ts` → **8/8 passed**.

## Gates (PRD-84 plan map)

| Gate | Status | Notes |
|---|---|---|
| G1 (A8) | ✅ static — asserts `persistence_initiated: processedEvents.length` + writes still non-blocking | runtime walk deferred (R1) |
| G2 (A9 normal) | ✅ static — asserts `.startsWith()` + `.slice(prefix.length)` and no `.replace()` | |
| G3 (A9 mismatch) | ✅ static — asserts mismatch is logged and the entry is omitted (no broken URL) | |
| G4 (tsc/build/tests) | ✅ all green | |

## Deferred runtime gates (post-run pass)

- **R1:** on a preview deploy, post a batch of valid + invalid events → response shows `accepted`, `rejected`, and `persistence_initiated`. Tail the server log briefly; if writes succeeded, no "events failed to persist" warning should fire.
- **R2:** load a tenant signature-summary view that fetches signature thumbnails for a known-good path → image renders. Force a non-matching path in the query (manual) → `signature_thumbnail_signed_url_failed` log present, entry omitted from the response.

## OPEN-DECISIONS entries (appended)

- `[PRD-84] events route posture: async + persistence_initiated (not await) — DECISION` (analytics-only today; flip to await if a downstream consumer ever needs confirmed persistence).
- `[PRD-84] signature-thumbnails prefix mismatch posture: skip + log — DECISION` (the safePaths filter already requires the per-app prefix; the explicit slice is a future-proofing guard).

## Notes / cross-PRD flags

- No prior-batch file reverted; no scope overlap with PRDs 80–83.
- No migrations.

---

## End-of-batch checklist (this is the last PRD in the batch)

- [x] PRD-80 (`400c81f`) — summary-signing ceremony hardening
- [x] PRD-81 (`eb2a02a`) — storage write-races round 2 *(deploy-blocker line crossed here)*
- [x] PRD-82 (`af32cae`) — member-token signer round 2
- [x] PRD-83 (`a600202`) — concurrency & clock correctness
- [x] PRD-84 (this commit) — observability & path-safety
- [ ] PR opened (Ready for Review, do not merge — Alex reviews)

Open A2 deploy-gate question for Alex is in PRD-81's report and OPEN-DECISIONS.
