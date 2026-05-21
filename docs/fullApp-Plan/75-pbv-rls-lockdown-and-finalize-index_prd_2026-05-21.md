# PRD-75 — PBV RLS Lockdown & Finalize Index

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-stress-test-hardening`
**Status:** Draft — ready for build
**Severity:** #3 is **P0 — deploy blocker** (two PBV tables are readable/writable by the anonymous `public` role in prod). #11 is P3 (a covering-index optimization, not a correctness issue).
**Source:** `docs/audits/pbv-stress-test-report_2026-05-21.md` — findings **#3** (CRITICAL) and **#11** (MEDIUM). Both are pure database migrations, so they share one PRD; neither touches application code.
**Scope guard:** Database migrations only. No application code, no RLS changes to any table other than the two named below.

---

## Important correction to the audit (confirmed 2026-05-21)

The audit says to "change `public` to `service_role`" on the two tables as if a bad migration created the open policy. Inspection of the committed migrations shows the situation is **migration-vs-prod drift**, which changes how this must be built:

- **`pbv_rejection_reason_templates`** — its migration ([supabase/migrations/20260514220000_pbv_rejection_reason_templates.sql:17-25](supabase/migrations/20260514220000_pbv_rejection_reason_templates.sql#L17)) already declares the *correct* policies: `authenticated` SELECT + `service_role` ALL. There is **no `public ALL` policy in the committed migration.** So if prod grants `public ALL qual=true` (as the audit found via Supabase MCP), prod has **drifted** from the committed migrations — an extra policy was added directly in prod, or RLS was altered out-of-band.
- **`pbv_document_requirements`** — there is **no migration for this table at all** (grep across `supabase/migrations/*.sql` returns nothing). The table exists in prod but was created out-of-band. [Inference] this is why its policy is wide open — it was never defined through the reviewed migration path. This matches the standing pattern noted for `source_pdf_status` (prod ≠ migration ≠ TS type).

Consequence: the remediation is a **forward, idempotent corrective migration** that (a) drops any `public`/over-broad policy if present and (b) (re)asserts the locked-down policy set — for `pbv_document_requirements` this also means bringing the table under migration control for the first time. Editing the existing rejection-templates migration in place would not help, because prod has already diverged from it.

---

## Problem Statement

**#3 — Two PBV tables grant the `public` role `ALL` with `qual=true` in prod (CRITICAL).** Any anonymous client (the unauthenticated `anon`/`public` role used by the tenant-facing app) can read and write `pbv_document_requirements` and `pbv_rejection_reason_templates`. Every other PBV table is `service_role`-only (e.g. [pbv_signature_events:39-43](supabase/migrations/20260515020000_pbv_signature_events.sql#L39)). These two are the exception and must match.

**#11 — `pbv_signature_events` lacks a covering index for the finalize hash check (MEDIUM, reframed).** `finalizeValidation.ts` Check 5 queries `.select('document_hash, signer_member_id').eq('form_document_id', formDoc.id)` ([lib/pbv/finalizeValidation.ts:141-142](lib/pbv/finalizeValidation.ts#L141)). An index on `form_document_id` **already exists** (`idx_pbv_signature_events_form`, [20260515020000_pbv_signature_events.sql:27-28](supabase/migrations/20260515020000_pbv_signature_events.sql#L27)), so the filter is already indexed — the equality lookup is not doing a sequential scan. The audit's suggested `(form_document_id, document_hash)` index is therefore a **covering-index optimization** (it lets the planner satisfy Check 5 with an index-only scan, skipping the heap fetch for `document_hash`), not a fix for a missing index. Given the `one_event_per_signer_per_form` unique constraint, there are only a handful of rows per `form_document_id`, so the practical gain is small. It is cheap to add and harmless, so we add it — but framed honestly as an optimization, not a correctness fix.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Open prod policy (×2) | prod `pbv_document_requirements`, `pbv_rejection_reason_templates` | `public ALL qual=true` per audit (Supabase MCP) |
| Rejection-templates migration | `20260514220000_pbv_rejection_reason_templates.sql:17-25` | already correct (`authenticated` read + `service_role` ALL) — prod drifted from it |
| `pbv_document_requirements` migration | none found | table is out-of-band; not under migration control |
| Reference pattern | `20260515020000_pbv_signature_events.sql:37-43` | the `service_role`-only shape every PBV table should match |
| Existing finalize-query index | `idx_pbv_signature_events_form` on `(form_document_id)` | already covers Check 5's WHERE clause |

---

## Goals

1. **#3:** Neither `pbv_document_requirements` nor `pbv_rejection_reason_templates` is accessible to the `public`/`anon` role. Both are `service_role`-only for writes; `pbv_rejection_reason_templates` keeps its `authenticated` SELECT (admin-UI dropdown depends on it — confirm before removing); `pbv_document_requirements` is `service_role`-only unless the build confirms an authenticated read is needed.
2. **#3:** `pbv_document_requirements` is brought under migration control with an idempotent definition that matches prod's actual columns (introspect first — do not guess the schema).
3. **#11:** A `(form_document_id, document_hash)` index exists on `pbv_signature_events` so the finalize Check-5 query can run index-only.
4. The corrective migration is idempotent (`DROP POLICY IF EXISTS`, `CREATE INDEX IF NOT EXISTS`) so it is safe to apply against a prod that may be in any of several drifted states.

## Non-goals

- No RLS changes to any other table.
- No data migration / no row edits to either table's contents.
- No application-code change (no route reads these tables differently afterward; `service_role` access via `supabaseAdmin` is unchanged).
- Do **not** apply migrations to prod (per BATCH-RUN-PROTOCOL) — commit + list in OPEN-DECISIONS for Alex to apply deliberately.

---

## Implementation phases

### Phase 1 — #3: corrective RLS migration
Add `supabase/migrations/<ts>_pbv_rls_lockdown.sql`. **Before writing it, introspect prod** (via Supabase MCP) to confirm: the exact policy names currently on both tables, whether RLS is enabled, and the real column list of `pbv_document_requirements`. Then write idempotently:

```sql
-- pbv_rejection_reason_templates: drop any drifted public policy, reassert locked-down set
ALTER TABLE public.pbv_rejection_reason_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "<the public ALL policy name found in prod>" ON public.pbv_rejection_reason_templates;
-- keep authenticated read + service_role ALL (recreate IF NOT already present)
-- ... (mirror 20260514220000 policy definitions, guarded by DROP POLICY IF EXISTS first)

-- pbv_document_requirements: bring under migration control, lock down
ALTER TABLE public.pbv_document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "<the public ALL policy name found in prod>" ON public.pbv_document_requirements;
CREATE POLICY "service_role full access on pbv_document_requirements"
  ON public.pbv_document_requirements FOR ALL TO service_role USING (true) WITH CHECK (true);
-- add an authenticated SELECT only if the admin UI reads this table directly (confirm)
```

Do **not** `CREATE TABLE pbv_document_requirements` blindly — it already exists in prod. If you want it represented in migrations for the first time, use `CREATE TABLE IF NOT EXISTS` with the **introspected** column definitions, placed so it cannot clobber prod data. If the real schema can't be confirmed in-session, scope this migration to the RLS policy statements only (which is all #3 strictly requires) and log the "table not yet under migration control" gap as a DECISION in OPEN-DECISIONS.

Verify after writing: confirm via Supabase MCP introspection that no `public`/`anon` grant remains on either table (read-only check — do not apply the migration).

### Phase 2 — #11: covering index
Add `supabase/migrations/<ts>_pbv_signature_events_hash_index.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_form_hash
  ON public.pbv_signature_events (form_document_id, document_hash);
```

Keep the existing `idx_pbv_signature_events_form` (some queries filter on `form_document_id` alone and benefit from the narrower index). Frame the comment as "covering index for finalizeValidation Check 5 (index-only scan); the single-column index already serves the filter."

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (#3):** the corrective migration parses (run through a SQL linter or `psql --dry-run`/`-f` against a throwaway local DB if available); statements are idempotent (re-runnable).
- **Gate 2 (#3, introspection):** Supabase MCP read confirms the *current* prod policy names so the `DROP POLICY IF EXISTS` targets the right names; and confirms no `public`/`anon` grant remains in the post-migration intended state (reason about it from the SQL — do not apply).
- **Gate 3 (#11):** index DDL parses; `IF NOT EXISTS` present.
- **Gate 4:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` clean (no code changed, so this is a regression check that nothing else broke).

**Deferred to the post-run verification pass (needs a DB; list in build report, do NOT block):**
- **Gate R1:** apply both migrations on staging; confirm `\d pbv_document_requirements` / `\d pbv_rejection_reason_templates` show no `public` policy and the index exists.
- **Gate R2:** from an `anon`-keyed client, confirm a SELECT/INSERT against both tables is denied after the migration.

---

## Open questions

- **O1 (#3):** Does the admin UI read `pbv_document_requirements` with an `authenticated` (not `service_role`) client? If yes, add an `authenticated` SELECT policy; if all access is via `supabaseAdmin`, keep it `service_role`-only. Default: `service_role`-only; log if you add an authenticated read.
- **O2 (#3):** Should `pbv_document_requirements` be fully reverse-engineered into a `CREATE TABLE IF NOT EXISTS` migration now, or is RLS-only sufficient for this PRD? Default: RLS-only for #3; log the table-under-migration-control gap.

## Decisions

- **D1 (#3):** Treat as drift remediation, not a migration edit — write a forward idempotent corrective migration; do not modify `20260514220000`.
- **D2 (#3):** `service_role`-only by default; preserve `authenticated` SELECT only where an admin UI provably needs it.
- **D3 (#11):** Add the composite covering index, keep the single-column index; documented as an optimization, not a missing-index fix.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `supabase/migrations/<ts>_pbv_rls_lockdown.sql` (new) | #3 | idempotent RLS lockdown on both tables — **commit only, list in OPEN-DECISIONS, do not apply** |
| `supabase/migrations/<ts>_pbv_signature_events_hash_index.sql` (new) | #11 | `(form_document_id, document_hash)` covering index — **commit only, list in OPEN-DECISIONS, do not apply** |

No application code changes. If introspection reveals additional open tables beyond the two named, do **not** expand scope — log them as a DECISION in OPEN-DECISIONS for a follow-up.
