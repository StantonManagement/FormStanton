# Batch 01 — Deploy-Gate Summary (PRP-001..005)

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commits:** `PRP-001..005` (+ docs commits) on top of the prep commit `cf13ac2`.

## Per-PRP commits
| PRP | Slug | Commit | Per-PRP gates |
|-----|------|--------|---------------|
| 001 | security-headers-and-csp | `cca98f8` | tsc ✅ ; build ✅ |
| 002 | rate-limiting-and-bruteforce-resistance | `e89cb56` | tsc ✅ ; vitest 15/15 ✅ |
| 003 | magic-bytes-file-validation | `e55b8b0` | tsc ✅ ; vitest 18/18 ✅ |
| 004 | env-validation-health-and-runtime-bootstrap | `61e3666` | tsc ✅ ; vitest 6/6 ✅ |
| 005 | functional-correctness-verification | `88fb2e9` | tsc ✅ ; vitest 9/9 ✅ |

## Batch-boundary gates
- **Full `npm run build`** — **clean.** (Required setting `CRON_SECRET=<dummy>` in env so the new `validate-env` gate from PRP-004 didn't block — which is exactly the right behaviour. Vercel builds skip `validate-env` via the existing `VERCEL_ENV` early-exit, so production builds aren't blocked; the gate fires for CI/local builds, which is where it belongs.)
- Pattern-sweep results below.

## Deploy-blocker line crossed
PRPs 001–004 cross the deploy-blocker line: CSP + tenant security headers, store-backed rate limiting (interface in place; production protection contingent on Upstash provisioning — logged), magic-bytes upload validation, env+health+runtime bootstrap. PRP-005 closes the open-items functional-correctness sweep with all five items verified-correct + regression-tested.

## Pattern sweep (touched-files & adjacent shapes)
- **Unthrottled `/api/t/*` routes outside the PBV lane:** 17 routes under `app/api/t/[token]/...` do **not** use `withTenantContext` (e.g. `/api/t/[token]/route.ts`, `/api/t/[token]/documents/[documentId]/route.ts`, `/api/t/[token]/status/route.ts`). These are project-unit / document-approval / status routes — not covered by Angle-2 audit D2/D3, which scoped the threat to the PBV-full-app lane. Follow-up: a small wrapper or per-route limiter for these would close the analogous brute-force/compute exposure.
- **Admin upload surfaces bypass magic-bytes:** 8 admin upload routes under `app/api/admin/*` still trust `file.type` (e.g. `/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts`, `/api/admin/scan-upload/route.ts`). PRP-003 was scoped to the tenant upload route only; the admin surfaces are lower exposure (staff-authenticated, smaller blast radius) but a shared `assertMagicBytes(buffer, allowedSet)` call at each entry point would harden them. Follow-up.
- **Fail-open defaults:** runtime env check fail-opens (`storeUnreachable` returns `allowed:true` for the rate limiter) — by design for "smoke-test" semantics during the in-memory phase; flip to fail-closed for expensive routes when Upstash lands.

## Decisions logged in OPEN-DECISIONS.md
- `[BATCH-RUN] Branch base` — created off `feat/pbv-adjacent-errors-hardening` HEAD because main is far behind and the audits inspected that state.
- `[PRP-002] Rate-limiter backend — BLOCKER` — Upstash/Vercel KV needs to be provisioned before the limiter is real protection against a distributed attacker.
- `[PRP-002] Signer lockout via counter, not DB column — DECISION`.
- `[SHELL-PROTOCOL] vitest direct-binary on Windows — DEFAULT` — `node node_modules/vitest/dist/cli.js run <path>` (not `node ./node_modules/.bin/vitest`, which is a bash shim).

## Deferred runtime gates (need a preview)
- CSP report-only headers present + zero violations on scanner/PDF preview (PRP-001).
- `curl /api/health` 200; bad env → 503 naming the var (PRP-004).
- 25 rapid `sign-form` requests → 429 + Retry-After at ~20 (PRP-002, contingent on Upstash).
- 15 invalid member-token GETs → lockout after the 10th, generic body (PRP-002).
- Renamed `.exe → .jpg` upload → 415; real photo + PDF → accepted (PRP-003).
- 3-adult household: 2 signatures finalize-blocks, 3rd unblocks (PRP-005 #6).
- `citizenship_declaration` with 2 adults: each adult's image renders in its slot (PRP-005 #5).
- Intake → review → submit lands on `/dashboard` (PRP-005 #7).
