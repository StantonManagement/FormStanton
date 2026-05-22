# PRP-021 — Operational Readiness: Support Runbook & Migration Backward-Compatibility

**Assigned batch (per BATCH_PLAN.md):** 05
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **I4** (Medium, tenant-support runbook), **I5** (Low, migration backward-compat); `docs/audits/pbv-open-items-and-suggestions_2026-05-21.md` Pass 3 #14 (`tenant_lookup` has no CREATE TABLE migration).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** the `supabase/migrations/` directory (look for tables referenced but never created with `IF NOT EXISTS`, esp. `tenant_lookup` referenced in `20260408210000` and `20260501000000`), the top tenant-support scenarios (expired link, locked packet, rejected doc, missing Submit button), and the existing prod schema for `tenant_lookup` (introspect read-only to snapshot its real columns).
**Outputs (write — the ONLY files this PRP may modify/create):** new `docs/runbooks/tenant-support-playbook.md`, a corrective `CREATE TABLE IF NOT EXISTS tenant_lookup (...)` migration (commit-only) + any other missing-creation migration the audit surfaces, new test/migration-lint (optional).
**Acceptance criteria:**
- `docs/runbooks/tenant-support-playbook.md` covers the top ~10 support scenarios with step-by-step resolutions.
- A migration creates `tenant_lookup` (`IF NOT EXISTS`, real columns from prod introspection) so a fresh environment (staging/prod clone) can be built from migrations; any other referenced-but-uncreated table is similarly addressed. Commit-only (not applied).

## Context (self-contained)
There is no operational runbook for support staff handling common tenant issues ("my link expired," "my packet is locked," "my document was rejected and I don't know why," "I can't see the Submit button"). Separately, some migrations reference tables created manually in early dev (notably `tenant_lookup`, referenced by later migrations but with no `CREATE TABLE` migration), so a fresh staging/prod clone built purely from migrations could fail. The corrective migration must reflect the **real** prod schema (introspect read-only first).

## Problem
- **I4:** no tenant-support runbook.
- **I5 / #14:** `tenant_lookup` (and possibly others) referenced without a creation migration → fresh environments may fail.

## Goals
1. **I4:** write `docs/runbooks/tenant-support-playbook.md` — top ~10 scenarios, each with cause + step-by-step resolution + which admin tool/action to use.
2. **I5:** audit migration ordering; write a `CREATE TABLE IF NOT EXISTS tenant_lookup (...)` migration matching the real prod schema (introspect read-only to get columns/types/constraints); address any other referenced-but-uncreated table. Migrations are commit-only.

## Non-goals
- No application code changes. No applying migrations to prod (commit-only; record as migration-to-apply). No destructive SQL. Do not edit files outside the Outputs list.

## Implementation
1. Write the runbook from the known support scenarios + the admin actions that resolve them (e.g. reopen a locked packet, regenerate a magic link, surface a rejection reason).
2. Introspect `tenant_lookup` (read-only) → write the `IF NOT EXISTS` creation migration with real columns; scan for other uncreated referenced tables and add migrations as needed.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean (no code change expected, but confirm).
- If a migration-lint/test exists, assert no migration references a table without a creation migration; else document a manual review.
- **No full build per PRP** (docs + SQL only).
- **Deferred runtime gates:** on a fresh DB (or shadow), run all migrations in order → no "relation does not exist" failure for `tenant_lookup` or others; spot-check the runbook against a real "expired link" case on a preview.

**Default for ambiguity:** if a referenced table's real schema can't be confirmed in-session, write the migration from the best-available column inference and flag it in the migration file + record it for Alex to verify against prod before applying.
