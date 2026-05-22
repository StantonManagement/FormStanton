# BATCH 05 — Compliance, Operations & Test Coverage (PRP-018 … PRP-022)

You are an autonomous Claude Code session running **Batch 05** (final) of a 5-batch PBV remediation: consent-version + log hygiene, data lifecycle + audit tamper-evidence, in-app-browser + CSRF, operational readiness, and test-coverage backfill. Run the five PRPs **in order**, one git commit each, no sign-off. Clean context; everything is in this file and the named PRP files.

## Working directory & branch
- Run from the repo root.
- Ensure branch **`feat/pbv-post-audit-remediation`** is checked out (create off `main` if missing). Shared branch.
- **This is the last batch — after PRP-022, open ONE PR** (`feat/pbv-post-audit-remediation` → `main`, Ready for Review, do **not** merge — Alex reviews). If `git`/PR creation fails in this environment, leave the branch pushed and note the PR step for Alex.

## ⚠️ This batch MUST run after Batch 01 (PRP-020 layers on PRP-002's file)
- **PRP-020** adds CSRF to `lib/pbv/tenantEndpoint.ts`, where Batch 01 (PRP-002) wired the rate limiter. Layer on it; **do not remove the limiter.** Do not run this batch in parallel with Batch 01.

## Shell rules (inlined)
- Type-check: `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`.**
- Tests: `node ./node_modules/.bin/vitest run <path>`. **Never `npx vitest`.** Targeted only.
- **No `npm run build` per PRP** (batch-boundary gate) unless a new migration changes a typed table the app reads.
- Migrations write+commit only; **no prod apply**; no destructive SQL. Supabase MCP read-only (e.g. PRP-021 introspecting `tenant_lookup`).

## PRPs in execution order
1. **PRP-018** (`PRP-018_consent-version-integrity-and-log-hygiene.md`) — `consent_versions` table + validation, log token/PII redaction, X-Forwarded-For. *Depends on: none.*
2. **PRP-019** (`PRP-019_data-lifecycle-and-audit-tamper-evidence.md`) — admin anonymization endpoint, retention policy doc, audit hash chain (or documented gap — see its scope call). *Depends on: none.*
3. **PRP-020** (`PRP-020_in-app-browser-detection-and-csrf.md`) — in-app-browser prompt + CSRF token. *Depends on: **PRP-002** (Batch 01)* — layer CSRF on the rate-limiter version of `tenantEndpoint.ts`.
4. **PRP-021** (`PRP-021_operational-readiness-runbook-and-migrations.md`) — tenant-support runbook + `tenant_lookup`/backward-compat migrations. *Depends on: none.*
5. **PRP-022** (`PRP-022_test-coverage-backfill.md`) — package hash, error-branch/visual/load/axe e2e + hook unit tests. *Depends on: none for building; run LAST.* (Authors e2e/axe/load as deliverables — they are **not** a blocking batch gate; the per-PRP gate is `tsc` + the new hook unit tests.)

No two PRPs in this batch write the same file.

## Per-PRP loop
1. Read the PRP; note **Outputs** + **Acceptance criteria**.
2. Implement only those files; default-and-note on ambiguity. (PRP-019 G4 hash-chain and PRP-020 CSRF each have a documented "implement vs document-as-gap" default — follow it; don't half-build.)
3. Per-PRP gates: `tsc --noEmit` clean; targeted `vitest` green. (PRP-022: the new **hook unit** tests, not e2e.)
4. Commit `PRP-0NN: <slug>` (push if git healthy).
5. Build report `docs/build-reports/PRP-0NN_<slug>_build-report_2026-05-21.md`.
6. Next PRP.

## Batch-boundary gates (after PRP-022)
- One full `npm run build` → clean.
- A **critical-path smoke** on a preview if one can be stood up: intake → generate-forms → sign → finalize (the integration-seam check that unit tests can't see). If no preview, list it as the first deferred gate with an owner.
- Pattern-sweep for other PII/token log sites the redaction util should cover.
- **Open the one PR** for the whole `feat/pbv-post-audit-remediation` branch.

## Done when
Five commits `PRP-018:`…`PRP-022:`; per-PRP gates green; boundary build clean; smoke run or deferred-with-owner; all migrations commit-only + listed; one PR opened (not merged); build reports written. The full remediation branch is ready for Alex's review.
