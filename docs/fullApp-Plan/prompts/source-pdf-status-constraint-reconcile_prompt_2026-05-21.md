# Prompt — Reconcile the `pbv_form_templates.source_pdf_status` constraint drift

**Date:** 2026-05-21
**For:** the build agent with DB access (the same Supabase MCP you used to apply the 2026-05-21 batch). **You run every query and every write yourself — no step asks Alex to run SQL by hand.**
**Target DB:** Supabase project `lieeeqqvshobnqofcdac` ("Tenant Communication") — the single live project. Writes here are production.
**Shell protocol:** `docs/SHELL-PROTOCOL.md`. Apply the new migration the same way the 2026-05-21 batch was applied (the `.mjs` runner / Management API path you already used), and also commit the `.sql` file so a fresh env reproduces the end state.

---

## Why this exists

While applying PRD-55b, `source_pdf_status = 'sourced'` was rejected by the live `pbv_form_templates` check constraint, which only accepts `('ready','pending','deprecated')` (or whatever Step 1 actually finds). It was patched in-place to `'ready'` and applied. That patch left three things out of agreement:

1. The committed table-defining migration `supabase/migrations/20260515040000_pbv_form_templates.sql:22` still builds `CHECK (source_pdf_status IN ('pending','sourced','verified'))`. A **fresh environment** applying migrations in order would then fail on PRD-55b's `'ready'` write.
2. The live prod constraint `('ready','pending','deprecated')` is created by **no migration anywhere** — undocumented hand-applied drift (same class as the PRD-69 buckets).
3. The TS type `lib/pbv/form-templates.ts:15` is `'pending' | 'sourced' | 'verified'` — it does not contain `'ready'`, so the field's declared type no longer matches the data.

Goal: end with **one** vocabulary that is identical across the live constraint, the migration files, every value any migration writes, and the TS type — and reproducible on a fresh env. Generation behavior must not change (it depends only on `generation_enabled`; confirm in Step 1e).

---

## Step 1 — Audit (run all of these; record the output before deciding)

**1a. The live constraint definition and its name** (you need the exact `conname` to drop it):
```sql
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.pbv_form_templates'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%source_pdf_status%';
```

**1b. What values actually exist in the rows, and how many of each:**
```sql
select source_pdf_status, count(*) as n
from public.pbv_form_templates
group by source_pdf_status
order by n desc;
```

**1c. Every value any committed migration writes to this column** (so the constraint can't reject a value a migration emits):
```sh
grep -rn "source_pdf_status" supabase/migrations/ | grep -iE "=\s*'|'[a-z]+'"
```
Inspect the seed `INSERT` in `20260515040000_pbv_form_templates.sql` (the `VALUES` block + the `ON CONFLICT … DO UPDATE`) and the `INSERT` in `20260520000000_prd55_form_generation_alignment.sql`, plus the four UPDATEs in `20260521000000_prd55b_form_sourcing_corrections.sql`. List the distinct literals.

**1d. The TS type:** confirm `lib/pbv/form-templates.ts:15` reads `'pending' | 'sourced' | 'verified'`.

**1e. Confirm no app logic branches on the *value*** (only on `generation_enabled`):
```sh
grep -rn "source_pdf_status" lib/ app/ components/
```
Expect: the type definition and `select('*')` reads only — no `=== 'sourced'` / `=== 'ready'` comparisons, no UI badge keyed to the literal. If you find a comparison or a UI mapping, note it; it changes the safety analysis and must be updated alongside.

Let **USED** = distinct values from 1b. Let **WRITTEN** = distinct literals from 1c. Let **LIVE** = the set inside the constraint from 1a.

---

## Step 2 — Decide the canonical vocabulary (deterministic)

**Default — consolidate to the original design `('pending','sourced','verified')`.**
Choose this when `USED ∪ WRITTEN` contains no value outside `{pending, sourced, verified, ready}` **and** there are **zero** rows with `source_pdf_status = 'deprecated'` (from 1b). In other words: the only stray value is the `'ready'` introduced by the PRD-55b patch, and `'deprecated'` carries no live data. This restores agreement with the table-defining migration and the TS type, and is the cleanest end state.

**Fallback — adopt a widened superset.**
Choose this when 1b shows real rows using `'deprecated'` (or any value outside the default set), i.e. the prod vocabulary is load-bearing and consolidating would lose meaning. Then **CANONICAL = LIVE ∪ USED ∪ WRITTEN** (a superset — widening a CHECK never rejects an existing row). Keep PRD-55b's `'ready'` values as-is.

Record which branch you took and the one-line reason, for the build report and the OPEN-DECISIONS update.

---

## Step 3 — Reconcile every surface to the chosen vocabulary

### If DEFAULT (`('pending','sourced','verified')`)

1. **Migration file PRD-55b** — `supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql`: change the two `source_pdf_status = 'ready'` back to `source_pdf_status = 'sourced'` (lines ~26 and ~38) so the file matches the canonical set and the original intent. Leave the two `'pending'` writes as-is.
2. **Migration file `20260515040000`** — confirm line 22 is already `CHECK (… IN ('pending','sourced','verified'))`. No change expected; confirm.
3. **TS type** — `lib/pbv/form-templates.ts:15`: already `'pending' | 'sourced' | 'verified'`. No change expected; confirm.
4. **New reconcile migration** — create `supabase/migrations/20260521070000_reconcile_source_pdf_status_constraint.sql`:
   ```sql
   -- Reconcile pbv_form_templates.source_pdf_status to the canonical set.
   -- Prod drifted to a different CHECK set by hand (no migration created it);
   -- the PRD-55b patch then wrote 'ready'. This brings the live constraint,
   -- the row values, the migration files, and the TS type back into agreement.
   -- Safe on existing rows: the UPDATE runs while the constraint is dropped.

   ALTER TABLE public.pbv_form_templates
     DROP CONSTRAINT IF EXISTS <conname-from-Step-1a>;        -- likely pbv_form_templates_source_pdf_status_check

   UPDATE public.pbv_form_templates
     SET source_pdf_status = 'sourced'
     WHERE source_pdf_status = 'ready';

   ALTER TABLE public.pbv_form_templates
     ADD CONSTRAINT pbv_form_templates_source_pdf_status_check
     CHECK (source_pdf_status IN ('pending','sourced','verified'));
   ```
   - On **prod**: drops the drifted constraint, normalizes the two `'ready'` rows to `'sourced'`, re-asserts the canonical constraint.
   - On a **fresh env**: the constraint is already canonical from `20260515040000`, there are no `'ready'` rows, so this is a re-assert with nothing to change.

### If FALLBACK (widened superset)

1. **New reconcile migration** `20260521070000_reconcile_source_pdf_status_constraint.sql`:
   ```sql
   ALTER TABLE public.pbv_form_templates
     DROP CONSTRAINT IF EXISTS <conname-from-Step-1a>;
   ALTER TABLE public.pbv_form_templates
     ADD CONSTRAINT pbv_form_templates_source_pdf_status_check
     CHECK (source_pdf_status IN ( <CANONICAL, comma-separated> ));
   ```
   No `UPDATE` — every existing value is kept. Widening only.
2. **Migration file `20260515040000:22`** — change its inline CHECK to the same `CANONICAL` set, so a fresh env builds the full vocabulary from the start (otherwise PRD-55b's `'ready'` fails on fresh env before this reconcile migration runs). This file is already applied to prod, so editing it changes only fresh-env behavior — it does not re-run on prod.
3. **TS type** `lib/pbv/form-templates.ts:15` — set the union to exactly `CANONICAL`.
4. **Leave PRD-55b's `'ready'` values as-is.**

---

## Step 4 — Apply + verify (via your DB tool, not by hand to Alex)

1. Apply `20260521070000_reconcile_source_pdf_status_constraint.sql` to prod through the same mechanism you used for the batch.
2. Re-run Step 1a and 1b. Confirm the live constraint now equals the canonical set and no row violates it.
3. Confirm generation is unchanged: `select form_id, generation_enabled, source_pdf_status from public.pbv_form_templates where generation_enabled = true order by form_id;` — the enabled set must be identical to before (only the `source_pdf_status` label on the two re-enabled forms may have moved `ready`→`sourced` under the default branch).
4. If Step 1e found any value-based comparison or UI mapping, re-check it renders correctly.

---

## Step 5 — Documentation

Update `docs/fullApp-Plan/OPEN-DECISIONS.md`:
- The PRD-55b entry and the EIV/criminal-background notes (~lines 198, 199, 257, 460) currently say `source_pdf_status='sourced'`. Under the **default** branch these become correct again automatically — confirm they read `'sourced'`. Under the **fallback** branch, update them to whatever value the rows hold.
- Add a short "source_pdf_status constraint reconciliation (2026-05-21)" note under "Prod migrations to apply": what the drift was, which branch you took and why, and that `20260521070000` is the migration of record. Mark it ✅ APPLIED with the date once Step 4 passes.

Add a one-paragraph build report at `docs/build-reports/source-pdf-status-constraint-reconcile_build-report_2026-05-21.md` (audit findings, branch chosen, files changed, verification output).

---

## Step 6 — Commit & push (native Windows terminal — the sandbox git index is unreliable)

If `git status` errors with an index-format complaint, repair first:
```powershell
cd C:\CursorProjects\FormStanton
del .git\index .git\index.lock      # ignore "not found"
git read-tree HEAD
git status
```
Then:
```powershell
git add supabase/migrations/20260521070000_reconcile_source_pdf_status_constraint.sql `
        supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql `
        lib/pbv/form-templates.ts `
        supabase/migrations/20260515040000_pbv_form_templates.sql `
        docs/fullApp-Plan/OPEN-DECISIONS.md `
        docs/build-reports/source-pdf-status-constraint-reconcile_build-report_2026-05-21.md
git status     # confirm ONLY the files your chosen branch actually changed are staged
git commit -m "fix: reconcile pbv_form_templates.source_pdf_status constraint drift

Live prod CHECK had drifted to a hand-applied set; the PRD-55b patch wrote 'ready'.
Reconciled the constraint, row values, migration files, and TS type to one vocabulary
(migration 20260521070000). Fresh-env reproducible. Generation behavior unchanged."
git push origin feat/pbv-tenant-polish
```
(Only stage `20260515040000` and `form-templates.ts` if your branch actually changed them — under the default branch they're unchanged and should not appear in the diff.)

---

## Done criteria

- Step 1a == the canonical set, with zero violating rows (Step 4).
- `lib/pbv/form-templates.ts` type == the canonical set.
- No migration file writes a value outside the canonical set; a fresh-env apply of `supabase/migrations/` in order succeeds with no constraint error.
- `generation_enabled = true` set is byte-identical to before.
- OPEN-DECISIONS no longer claims a value the DB doesn't hold; `20260521070000` is recorded as the migration of record.
- One commit on `feat/pbv-tenant-polish`, pushed.

**No PR opened — that stays Alex's call.**
