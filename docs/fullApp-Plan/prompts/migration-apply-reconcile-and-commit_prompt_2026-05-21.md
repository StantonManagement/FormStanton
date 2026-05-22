# Prompt — Apply the 2026-05-21 PBV migration batch, reconcile what didn't run, then commit & push

**Date:** 2026-05-21
**Author context:** Cowork (plan + verify). Hand this to whoever runs the apply (Windsurf agent with shell access, or Alex directly). It does three things: (1) reconciles what's actually in the DB vs. the migration files, (2) applies the pending 2026-05-21 batch in order, (3) commits and pushes the bookkeeping.
**Target DB:** Supabase project `lieeeqqvshobnqofcdac` ("Tenant Communication"). **This is the single live project — there is no separate dev/prod.** Applying here is applying to production. Treat accordingly.
**Shell protocol:** see `docs/SHELL-PROTOCOL.md`. PRD-specific deviation: this prompt *does* execute SQL against the DB (the protocol's "agents don't run migrations" rule is overridden here by explicit instruction). Apply via the established `.mjs` + Supabase Management API pattern, **not** `supabase db push` (see the duplicate-timestamp note in Part 1 for why `db push` is unsafe on this repo right now).

---

## Guardrails (read before running anything)

1. **Do NOT apply `20260521060000_prd72_form_display_name_pt_backfill.sql` in this run.** It is gated on native Portuguese review of the 18 values (see OPEN-DECISIONS "Prod migrations to apply" → PRD-72). Leave it out of the apply list entirely.
2. **PRD-65 needs a tenant-comms heads-up FIRST.** Applying `20260521030000_prd65_government_id_required.sql` makes every in-flight tenant see a new required Photo ID slot on their next visit. Confirm with Alex that the heads-up message has gone out (or that it's acceptable to skip) before applying step 4.
3. **Two migrations are code-coupled** — apply them *before* the matching code is deployed, never after: `…020000_finalize_pbv_application_fn` (PRD-64; `finalize/route.ts` 500s if the function is absent) and `…040000_prd66_form_generation_version` (PRD-66; `generate-forms/route.ts` 500s if the column is absent). Since that code is still on a branch and not yet on prod, applying the migrations first is safe and is the correct order.
4. **[inference] PRD-55b is also coupled to a deploy.** It flips `criminal_background_release` and `eiv_guide_receipt` to `generation_enabled = TRUE`. If the currently-deployed prod code tries to generate those forms before their source PDFs (`assets/pbv-source-pdfs/…`) are deployed, generation can fail. Confirm the source assets are live on prod **before or with** the deploy that ships this flag — do not enable generation ahead of the assets. This is not flagged as code-coupled in OPEN-DECISIONS; verify before applying step 1.
5. **One retry, then stop and report** (per SHELL-PROTOCOL). No silent workarounds, no switching apply mechanisms mid-run.

---

## Part 0 — Pre-flight

```sh
# Confirm you're on the branch that contains every migration file.
cat .git/HEAD            # expect: ref: refs/heads/feat/pbv-tenant-polish
ls supabase/migrations/2026052*.sql
```

The apply mechanism reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` to derive the project ref and needs a personal access token in `SUPABASE_ACCESS_TOKEN` (`sbp_…`, from https://app.supabase.com/account/tokens). Confirm both are available to the shell before proceeding. Model everything on the existing, working pattern in `scripts/apply-prd24-migrations.mjs`.

---

## Part 1 — Reconcile: what's already applied, and what (if anything) didn't run

This repo applies migrations by **running each `.sql` file explicitly through the Management API** — there is no `supabase db push`, so the `supabase_migrations.schema_migrations` ledger is likely empty or stale. That means "did this run?" has to be answered by **schema introspection**, not by trusting a ledger.

### 1a. Check whether a ledger exists at all

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

If this errors ("relation does not exist") or returns far fewer rows than the ~100 files in `supabase/migrations/`, the ledger is not authoritative — rely on 1b and 1c.

### 1b. Duplicate-timestamp audit (this is the main "what silently didn't run" risk)

Six version prefixes are shared by **two** files each. If anyone ever runs `supabase db push` (which keys by version, not filename), only one file per pair gets tracked/applied and the other is silently skipped. Confirm **both** files in each pair are reflected in the schema:

| Shared version | File A | File B |
|---|---|---|
| `20260513180000` | `in_app_signature_capture.sql` | `review_workflow.sql` |
| `20260514120000` | `application_documents.sql` | `tenant_notifications_unified.sql` |
| `20260514230000` | `pbv_signature_audit_log.sql` | `tenant_idempotency_keys.sql` |
| `20260515030000` | `application_document_revisions.sql` | `pbv_summary_documents.sql` |
| `20260515040000` | `packet_intake_substrate.sql` | `pbv_form_templates.sql` |
| `20260520000000` | `pbv_preapp_email_and_override.sql` | `prd55_form_generation_alignment.sql` |

The last pair is the one to scrutinize now: OPEN-DECISIONS records `prd55_form_generation_alignment` as APPLIED 2026-05-20, but says nothing about its same-timestamp sibling `pbv_preapp_email_and_override`. Confirm the sibling's objects exist:

```sql
-- pbv_preapp_email_and_override — confirm its columns landed (open the file and
-- match the actual ALTER/ADD targets; example shape below — verify against the file):
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'pbv_preapplications'   -- confirm table name in the .sql
order by column_name;
```

For each of the other five pairs, open both files and run an equivalent "does the object this file creates exist?" check. **Action if a sibling is missing:** apply that one file by path through the same `.mjs` runner used in Part 2. **Forward fix (separate follow-up, not this run):** rename the lexically-second file in each pair to a unique +1-second timestamp so a future `supabase db push` can't skip it.

### 1c. Presence-checks for the 2026-05-21 batch (run all six; record yes / no / partial)

```sql
-- 55b — data flip on form templates. Applied if criminal_background_release &
-- eiv_guide_receipt are TRUE, and insurance_settlement & cd_trust_bond are FALSE.
select form_id, generation_enabled, source_pdf_status, category
from public.pbv_form_templates
where form_id in ('criminal_background_release','eiv_guide_receipt',
                  'insurance_settlement','cd_trust_bond')
order by form_id;

-- 62 — column add. Applied if 1 row.
select column_name from information_schema.columns
where table_schema='public' and table_name='pbv_form_documents'
  and column_name='unsigned_pdf_hash';

-- 64 — function. Applied if present with args (uuid, timestamptz, text).
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='finalize_pbv_application';

-- 65 — template row + backfill. Applied if the template row exists AND
-- missing_slots = 0 (no in-progress app is missing its government_id slot).
select 1 as gov_id_template_exists from public.form_document_templates
where form_id='pbv-full-application' and doc_type='government_id';

select count(*) as missing_slots
from public.pbv_full_applications a
where a.submitted_at is null
  and exists (select 1 from public.application_documents ad
              where ad.anchor_type='pbv_full_application' and ad.anchor_id=a.id)
  and not exists (select 1 from public.application_documents ad2
                  where ad2.anchor_type='pbv_full_application' and ad2.anchor_id=a.id
                    and ad2.doc_type='government_id');

-- 66 — column add. Applied if present with default 1, not null.
select column_name, column_default, is_nullable from information_schema.columns
where table_schema='public' and table_name='pbv_form_documents'
  and column_name='generation_version';

-- 69 — storage buckets. On prod, expect all three already present (this migration
-- is a no-op there). Applied/present if 3 rows.
select id, public, file_size_limit, allowed_mime_types from storage.buckets
where id in ('pbv-signatures','form-submissions','pbv-applications')
order by id;
```

**Output of Part 1:** a short table — each of the six migrations marked APPLIED / NOT APPLIED / PARTIAL — plus the duplicate-pair audit result. Anything already APPLIED gets skipped in Part 2. Every migration in the batch is idempotent (per OPEN-DECISIONS and confirmed in the SQL: `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `ON CONFLICT … DO …`, `WHERE NOT EXISTS`, per-`form_id` `UPDATE`), so re-running a PARTIAL one is safe — but skip confirmed-APPLIED ones to keep the run clean.

---

## Part 2 — Apply the pending batch (timestamp order, PT backfill EXCLUDED)

Create `scripts/apply-2026-05-21-batch.mjs`, copied from `scripts/apply-prd24-migrations.mjs`, with the `migrations` array set to exactly these six in this order (drop any that Part 1 marked APPLIED):

```js
const migrations = [
  'supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql', // PRD-55b  [confirm assets deployed first — Guardrail 4]
  'supabase/migrations/20260521010000_prd62_unsigned_pdf_hash.sql',          // PRD-62   additive column
  'supabase/migrations/20260521020000_finalize_pbv_application_fn.sql',      // PRD-64   CODE-COUPLED: before finalize/route.ts deploy
  'supabase/migrations/20260521030000_prd65_government_id_required.sql',     // PRD-65   tenant-comms heads-up FIRST — Guardrail 2
  'supabase/migrations/20260521040000_prd66_form_generation_version.sql',    // PRD-66   CODE-COUPLED: before generate-forms/route.ts deploy
  'supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql', // PRD-69 no-op on prod; needed only for fresh env
];
// DO NOT add 20260521060000_prd72_form_display_name_pt_backfill.sql — gated on native PT review.
```

Run it:

```sh
SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-2026-05-21-batch.mjs
```

The runner stops on the first failure (`process.exit(1)`). If one fails: capture the exact error, do **not** continue, report to Alex. Because each statement is idempotent, a re-run after a fix re-applies cleanly.

**Cutover ordering reminder:** migrations first, code deploy second. The two code-coupled functions/columns (64, 66) must exist in the DB before their routes serve traffic; the additive ones (62, 65, 69) and the data flip (55b, subject to Guardrail 4) are safe to land ahead of the deploy.

---

## Part 3 — Post-apply verification

Re-run every query in Part 1c — each should now report APPLIED. Then the per-migration spot-checks (these mirror the verification notes in OPEN-DECISIONS):

```sql
-- 55b
select form_id, generation_enabled, source_pdf_status, category, notes
from public.pbv_form_templates
where form_id in ('criminal_background_release','eiv_guide_receipt',
                  'insurance_settlement','cd_trust_bond')
order by form_id;
-- expect: criminal_background_release TRUE/sourced/sign; eiv_guide_receipt TRUE/sourced;
--         insurance_settlement FALSE/pending; cd_trust_bond FALSE/pending.

-- 64 — smoke the function signature is callable by service_role (do NOT call it
-- against a real app id; just confirm it resolves).
select has_function_privilege('service_role',
  'public.finalize_pbv_application(uuid, timestamptz, text)', 'execute');

-- 65 — confirm the template sorts first and in-progress apps now carry the slot.
select doc_type, display_order, required, category
from public.form_document_templates
where form_id='pbv-full-application' order by display_order;

-- 69 — confirm the three buckets exist (no-op confirmation on prod).
select id, public from storage.buckets
where id in ('pbv-signatures','form-submissions','pbv-applications') order by id;
```

If anything reads wrong, the rollback for each migration is in `docs/fullApp-Plan/OPEN-DECISIONS.md` → "Prod migrations to apply" (per-migration `DROP COLUMN IF EXISTS` / `DROP FUNCTION` / reverse-UPDATE / DELETE blocks). Do not improvise rollbacks; use those.

---

## Part 4 — Commit & push plan

### What changed and needs committing
- **New:** `scripts/apply-2026-05-21-batch.mjs` (the runner you created in Part 2).
- **Edited:** `docs/fullApp-Plan/OPEN-DECISIONS.md` — flip each applied migration's status line from `⏳ NOT APPLIED` to `✅ APPLIED 2026-05-21` (leave the PRD-72 entry as ⏳; it was deliberately not applied).
- **Edited:** `docs/IN-FLIGHT.md` (and the session state snapshot) — record the apply.
- The migration `.sql` files themselves are **already committed** on this branch — do not re-add them.

### Step 0 — git index health (do this in a NATIVE Windows terminal, not the sandbox)
The sandbox `.git/index` has corrupted repeatedly this project; git writes from the sandbox are unreliable. Run all git commands below in PowerShell/Git Bash on the host. If `git status` errors with an index-format complaint:

```powershell
cd C:\CursorProjects\FormStanton
del .git\index .git\index.lock        # index.lock may not exist — ignore "not found"
git read-tree HEAD
git status                             # should now work
```

### Step 1 — stage and commit on the current branch (`feat/pbv-tenant-polish`)
```powershell
git add scripts/apply-2026-05-21-batch.mjs `
        docs/fullApp-Plan/OPEN-DECISIONS.md `
        docs/IN-FLIGHT.md
git status        # confirm ONLY those files are staged — nothing stray
git commit -m "ops: apply 2026-05-21 PBV migration batch (55b,62,64,65,66,69); PT backfill held for native review

Applied to prod (lieeeqqvshobnqofcdac) in timestamp order via scripts/apply-2026-05-21-batch.mjs.
PRD-72 PT display-name backfill deliberately NOT applied — gated on native PT review.
OPEN-DECISIONS statuses flipped to APPLIED; reconciliation + duplicate-timestamp audit recorded."
```

### Step 2 — push
```powershell
git push origin feat/pbv-tenant-polish
```
If `git push` hangs >30s it's the network, not git — retry once (per SHELL-PROTOCOL).

### Step 3 — branch / PR chain (decision is Alex's — do NOT auto-open PRs)
Current chain, none merged: `feat/pbv-tenant-polish` ← branched off `feat/pbv-launch-hardening` ← off `main`. The tenant-polish branch already contains the full launch-hardening history plus PRD-72/73. Two clean ways to land it:

- **Single PR:** `feat/pbv-tenant-polish` → `main` (carries 66–73 in one review). Simplest, but a large diff.
- **Stacked PRs:** `feat/pbv-launch-hardening` → `main` first, then `feat/pbv-tenant-polish` → `main`. Smaller reviews, but the second can't merge until the first does.

Either way, the **deploy of the code in these branches must follow the migration apply**, not precede it (Guardrails 2–4). Flag to Alex which PR shape he wants; don't open them unprompted.

---

## One-line summary of what to apply vs. hold

**Apply now (6):** `55b → 62 → 64 → 65 → 66 → 69` in that order, after the PRD-65 tenant heads-up and after confirming PRD-55b's source assets are deployed.
**Hold (1):** `72` PT display-name backfill — until native PT review clears the 18 values in OPEN-DECISIONS.
