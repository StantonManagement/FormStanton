# PRP-021 — Operational Readiness — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `73e66ed25917b7811e822c705f6ce6f7df746508`
**Findings closed:** Angle-2 **I4** (runbook), **I5** + open-items #14 (`tenant_lookup` creation migration).

## Files changed
- `docs/runbooks/tenant-support-playbook.md` *(new)* — 10-scenario support playbook.
- `supabase/migrations/20260521120000_tenant_lookup_create_if_not_exists.sql` *(new, MIGRATION-TO-APPLY-OPTIONAL)* — corrective backfill creation migration.

## Path taken (defaults logged)
- **`tenant_lookup` column set is inferred**, not introspected from prod (the Supabase MCP read-only path wasn't exercised in this run). Documented as such in both the migration's comment block and the build report. Prod is unaffected; the migration is for fresh clones / staging / disaster recovery.
- **No code change**; PRP-021 is docs + SQL only.
- **Runbook scope**: 10 scenarios + a quick-reference table of admin actions. Cross-links to every PRP that closed an underlying defect (002/010/012/014/016/017/019).

## MIGRATION-TO-APPLY
- `20260521120000_tenant_lookup_create_if_not_exists.sql` — idempotent (`IF NOT EXISTS`); LOW PRIORITY because prod is already in the state the migration produces. Apply on fresh clones; **verify the inferred column set against prod first** if relying on it as the source of truth for new environments.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.** (No surface touched.)
- No vitest test added (docs + SQL only).

## Deferred runtime gates
- On a fresh DB built purely from `supabase/migrations/`, run all migrations in order → no "relation 'tenant_lookup' does not exist" error.
- Spot-check the runbook against three real support scenarios (e.g. an expired link, a packet-locked complaint, a rejected document) → each resolution path is accurate.

## Follow-ups
- Introspect `tenant_lookup` against prod once Supabase MCP access is wired, and update the migration to mirror the real column types / nullability / defaults / indexes exactly.
- A migration-lint step that fails CI when a SQL file references a table that no earlier migration creates would prevent future I5-class drift.
