# BATCH 01 — Pre-Launch Blockers (PRP-001 … PRP-005)

You are an autonomous Claude Code session running **Batch 01** of a 5-batch PBV remediation. This batch is the **deploy gate** — security headers/CSP, rate limiting, file validation, env/health, and functional-correctness verification. Run the five PRPs **in order**, one git commit each, without stopping for sign-off. This session has a clean context; everything you need is in this file and the PRP files it names.

## Working directory & branch
- Run from the repo root (the folder containing `next.config.js`, `app/`, `lib/`, `supabase/`).
- Ensure branch **`feat/pbv-post-audit-remediation`** exists and is checked out; create it off `main` if missing. All five batches commit to this one branch. Do **not** open a PR until Batch 05.

## Shell rules (inlined — these prevent the hangs we hit before)
- Type-check: `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`** (hangs on Windows).
- Tests: `node ./node_modules/.bin/vitest run <path>`. **Never `npx vitest`** (same hang risk). Targeted paths only.
- **Do NOT run `npm run build` per PRP** — it is the batch-boundary gate. Exception: **PRP-001** edits `next.config.js`+`middleware.ts` (build surface) → build that one. (Full reference: `docs/SHELL-PROTOCOL.md`, `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md`.)
- Migrations: write + commit only. **Never apply to prod (`lieeeqqvshobnqofcdac`)**; never run destructive SQL. Supabase MCP read-only for introspection.

## ⚠️ One blocking decision in this batch — PRP-002 rate-limit backend
A rate limiter needs a **shared, cross-instance** store (Upstash/Redis/Vercel KV). An in-memory `Map` resets per serverless instance and is **not** real protection. If no shared store is provisioned, build the limiter behind a clean interface, wire it, and **record the unresolved backend decision** in a build report — do **not** ship in-memory as if it limited a distributed attacker.

## PRPs in execution order
1. **PRP-001** (`PRP-001_security-headers-and-csp.md`) — CSP (report-only) + tenant-route security headers. *Depends on: none.* **Build this PRP (build surface).**
2. **PRP-002** (`PRP-002_rate-limiting-and-bruteforce-resistance.md`) — store-backed rate limiter + signer lockout. *Depends on: none* (see blocking decision above).
3. **PRP-003** (`PRP-003_magic-bytes-file-validation.md`) — server-side magic-byte upload validation. *Depends on: none.*
4. **PRP-004** (`PRP-004_env-validation-health-and-runtime-bootstrap.md`) — `CRON_SECRET` validation + `/api/health` + runtime env check. *Depends on: none.*
5. **PRP-005** (`PRP-005_functional-correctness-verification.md`) — verify-first fixes: multi-signer image, `each_adult` collapse, intake routing, fieldMap gating, row-patterns. *Depends on: none.* (Verify before changing — some items may already be correct.)

No two PRPs in this batch write the same file. **Cross-batch note:** PRP-002 edits `lib/pbv/tenantEndpoint.ts` and PRP-005 edits `generate-forms` — later batches (05, 04) layer on these, so Batch 01 must complete before them (the loop guarantees this).

## Per-PRP loop
For each PRP in order:
1. Read the PRP file. Note its **Outputs** (the only files you may modify) and **Acceptance criteria**.
2. Implement only that PRP's Outputs files. Take the preferred path; if you must take a fallback or hit ambiguity, pick the documented default, do it, and write a one-line note in the build report.
3. Per-PRP gates: `tsc --noEmit` clean; the PRP's targeted `vitest` green. (PRP-001 also: `npm run build` clean.)
4. One commit: `PRP-0NN: <slug>`. Push if git is healthy.
5. Write `docs/build-reports/PRP-0NN_<slug>_build-report_2026-05-21.md`: files changed + SHA, path taken, gates pass/fail, deferred runtime gates, any decision/migration logged. (PRP-005: record verified/gap evidence per item.)
6. Next PRP.

## Batch-boundary gates (after PRP-005, before finishing)
- One full `npm run build` → clean.
- Pattern-sweep the touched files for the shapes this batch targets: any **other** unthrottled tenant route, any remaining **trusted-input** (missing UUID/enum/magic-byte) path, any **fail-open** default. Record findings (they may seed a follow-up).
- Note the deploy-blocker line is crossed (PRP-001..004) in a final summary.

## Done when
Five commits `PRP-001:`…`PRP-005:` on `feat/pbv-post-audit-remediation`; per-PRP gates green; PRP-001 + boundary build clean; five build reports; PRP-002 backend status (real store vs logged decision) recorded; any migration commit-only and listed for Alex. Do **not** open a PR (Batch 05 does).
