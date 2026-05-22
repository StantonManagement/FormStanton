# PRD-75 — RLS Lockdown & Finalize Index — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-stress-test-hardening`
**PRD:** `docs/fullApp-Plan/75-pbv-rls-lockdown-and-finalize-index_prd_2026-05-21.md`
**Audit findings remediated:** #3 (CRITICAL — deploy blocker), #11 (MEDIUM, reframed)

## Deploy-blocker status

**#3 cleared at this commit.** The corrective RLS migration drops every `public`-role policy on `pbv_document_requirements` and `pbv_rejection_reason_templates` and reasserts the locked-down policy set (`service_role` ALL + `authenticated` SELECT on rejection-templates only). Idempotent — safe to re-apply.

Note: the migration is **commit-only**. The deploy-blocker is cleared in the migration text; the actual lockdown takes effect **only when Alex applies** `20260521090000_pbv_rls_lockdown.sql` on prod.

## Files changed

**New migrations (commit only — both listed in OPEN-DECISIONS):**
- `supabase/migrations/20260521090000_pbv_rls_lockdown.sql` — RLS lockdown on both tables. Uses `DO $$ ... $$` to discover the drifted public-role policies by introspecting `pg_policies` (policy names are unknown because the drift was added out-of-band); then reasserts the locked-down set.
- `supabase/migrations/20260521100000_pbv_signature_events_hash_index.sql` — `(form_document_id, document_hash)` covering index for finalize Check 5. The existing single-column `idx_pbv_signature_events_form` is kept.

**No application code changes.**

## Path taken — fallback on O2, preferred everywhere else

- **#3 corrective RLS:** preferred path on the policy lockdown. Used `DO $$` loop over `pg_policies` to find the drifted public-role policies rather than hardcoding a guess at their names.
- **#3 schema-under-migration (O2):** took the documented fallback. The PRD's preferred path was to reverse-engineer a `CREATE TABLE IF NOT EXISTS` for `pbv_document_requirements` using introspected prod columns, but Supabase MCP introspection is not available in this batch's tooling. RLS-only is sufficient to remediate #3; the table-under-migration gap is logged in OPEN-DECISIONS for a follow-up.
- **#3 O1 — no `authenticated` SELECT on `pbv_document_requirements`:** preferred default. Only code reader is `generate-forms/route.ts` via `supabaseAdmin`.
- **#11 covering index:** preferred — composite index, narrower index kept.

## OPEN-DECISIONS entries added

1. **[PRD-75] `pbv_document_requirements` not brought under migration control — DECISION (O2):** fallback path; introspection not available.
2. **[PRD-75] No `authenticated` SELECT on `pbv_document_requirements` — DECISION (O1):** service_role-only.
3. **[PRD-75] Policy-name discovery via `pg_policies` loop — DECISION:** defensive idempotency for unknown drifted policy names.
4. **[PRD-75] `20260521090000_pbv_rls_lockdown.sql` — MIGRATION-TO-APPLY.**
5. **[PRD-75] `20260521100000_pbv_signature_events_hash_index.sql` — MIGRATION-TO-APPLY.**

## Static gates

| Gate | Result |
|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ Clean (regression — no code changes) |
| Migration SQL — idempotent re-runnable | ✅ `DROP POLICY IF EXISTS` + `CREATE INDEX IF NOT EXISTS` throughout; `DO $$` block re-discovers drift on every run |
| `npm run build` | ✅ Clean |

## Deferred runtime gates (post-run manual pass — these need a live DB)

- **R1 (#3):** apply `20260521090000` on staging. Then run:
  ```sql
  SELECT tablename, policyname, roles, cmd
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('pbv_document_requirements','pbv_rejection_reason_templates')
  ORDER BY tablename, policyname;
  ```
  Confirm no row has `public` in the `roles` array.
- **R2 (#3):** from an `anon`-keyed Supabase client (or `curl` with the anon key), run a SELECT against both tables. Expect 0 rows / permission denied.
- **R3 (#11):** after applying `20260521100000` on staging, run `EXPLAIN (ANALYZE, BUFFERS) SELECT document_hash, signer_member_id FROM pbv_signature_events WHERE form_document_id = '<a real id>';` and confirm the planner uses `idx_pbv_signature_events_form_hash` (Index Only Scan).

## Notes

- The migration is **commit only**; not applied to `lieeeqqvshobnqofcdac`. The audit-flagged vulnerability is not actually patched on prod until Alex runs `20260521090000`.
- The migration ordering (90000 before 100000) does not matter — both are independent.
- No application code change means the existing PBV unit tests are unaffected; no targeted vitest run is meaningful here.
