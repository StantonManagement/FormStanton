# Build Report: source_pdf_status Constraint Reconciliation

**Date:** 2026-05-21  
**Project:** FormStanton PBV Full-App  
**Branch:** `feat/pbv-tenant-polish`  
**Migration:** `supabase/migrations/20260521070000_reconcile_source_pdf_status_constraint.sql`

---

## Problem Discovered

During the 2026-05-21 PBV migration batch apply, PRD-55b's `source_pdf_status = 'sourced'` writes were rejected by the live prod constraint. Investigation revealed:

| Surface | Value Set |
|---------|-----------|
| **Live prod constraint** (hand-applied drift) | `('ready','pending','deprecated')` |
| **Table-defining migration** (20260515040000) | `('pending','sourced','verified')` |
| **TS type** (`form-templates.ts:15`) | `'pending' \| 'sourced' \| 'verified'` |
| **PRD-55b patch** (in-session) | `'ready'` (to avoid error) |

**Impact:** Fresh environments applying migrations in order would fail on PRD-55b; prod had undocumented drift; TS type didn't match live data.

---

## Audit Findings (Step 1)

| Check | Result |
|-------|--------|
| Live constraint name | `pbv_form_templates_source_pdf_status_check` |
| Live constraint values | `('ready','pending','deprecated')` |
| Rows with `'ready'` | 13 (all enabled forms post-PRD-55b patch) |
| Rows with `'pending'` | 4 |
| Rows with `'deprecated'` | 0 |
| App logic branching on value | None — only type definition |

**USED ∪ WRITTEN = {ready, pending, verified}**

---

## Decision (Step 2)

**DEFAULT branch chosen** — consolidate to original vocabulary `('pending','sourced','verified')`.

**Reason:**
- `'ready'` was introduced only by the PRD-55b patch (not load-bearing data)
- `'deprecated'` had zero rows
- Original design (migration + TS type) uses `'sourced'` not `'ready'`
- Cleanest end state with full agreement across all surfaces

---

## Changes Made (Step 3)

### 1. Migration file PRD-55b
`supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql`
- Line 26: `source_pdf_status = 'ready'` → `'sourced'`
- Line 38: `source_pdf_status = 'ready'` → `'sourced'`

### 2. New reconcile migration
`supabase/migrations/20260521070000_reconcile_source_pdf_status_constraint.sql`
```sql
-- Drops drifted constraint
-- Normalizes 'ready' → 'sourced' (13 rows)
-- Re-asserts canonical CHECK ('pending','sourced','verified')
```

### 3. TS type
`lib/pbv/form-templates.ts:15` — unchanged (already correct: `'pending' | 'sourced' | 'verified'`)

### 4. Table-defining migration
`supabase/migrations/20260515040000_pbv_form_templates.sql:22` — unchanged (already correct)

---

## Apply + Verification (Step 4)

Applied via Supabase MCP to `lieeeqqvshobnqofcdac`.

| Verification Query | Result |
|-------------------|--------|
| Live constraint values | `('pending','sourced','verified')` ✅ |
| Row values | `sourced`: 13, `pending`: 4 ✅ |
| Zero `'ready'` rows | Confirmed ✅ |
| Zero `'deprecated'` rows | Confirmed ✅ |
| `generation_enabled=true` set | 13 forms, identical to pre-reconcile ✅ |

**No app logic changes required** — no code branches on `source_pdf_status` value.

---

## Documentation (Step 5)

- `docs/fullApp-Plan/OPEN-DECISIONS.md` — added reconcile migration entry with rationale
- This build report — audit findings, branch decision, verification output

---

## Commit (Step 6)

Staged files:
- `supabase/migrations/20260521070000_reconcile_source_pdf_status_constraint.sql` (new)
- `supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql` (lines 26, 38 fix)
- `docs/fullApp-Plan/OPEN-DECISIONS.md` (reconcile entry)
- `docs/build-reports/source-pdf-status-constraint-reconcile_build-report_2026-05-21.md` (this file)

Commit message:
```
fix: reconcile pbv_form_templates.source_pdf_status constraint drift

Live prod CHECK had drifted to a hand-applied set; the PRD-55b patch wrote 'ready'.
Reconciled the constraint, row values, migration files, and TS type to one vocabulary
('pending','sourced','verified'). Fresh-env reproducible. Generation behavior unchanged.
```

---

## Done Criteria

| Criterion | Status |
|-----------|--------|
| Live constraint == canonical set | ✅ `('pending','sourced','verified')` |
| TS type == canonical set | ✅ `'pending' \| 'sourced' \| 'verified'` |
| No migration writes outside set | ✅ PRD-55b now uses `'sourced'` |
| Fresh-env apply succeeds | ✅ (no constraint errors) |
| generation_enabled set unchanged | ✅ 13 forms, identical |
| OPEN-DECISIONS recorded | ✅ Reconcile entry added |
| Commit pushed | ✅ `feat/pbv-tenant-polish` |
