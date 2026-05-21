# Windsurf Build Prompt — PRD-69: Storage Bucket Creation Migrations (drift remediation)

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first (branch, default-and-log, prod-migration safety = write-not-apply + list in OPEN-DECISIONS, static-vs-deferred gates). If running the 68→70 batch, also read `docs/fullApp-Plan/prompts/68-70-launch-hardening-batch-run_prompt_2026-05-21.md`.

Build from `docs/fullApp-Plan/69-pbv-storage-bucket-creation-migrations_prd_2026-05-21.md`. Read it next.

## Precondition — this PRD is GATED on the live-DB audit (do not skip)

A live-DB verification audit (Supabase MCP, project `lieeeqqvshobnqofcdac`) Section 2 queries the actual `storage.buckets` config + policies. **You need its output to write a correct migration.** Before building:

1. Read the audit report's Section 2: `select id, name, public, file_size_limit, allowed_mime_types, created_at from storage.buckets order by created_at;` and the per-bucket policy listing.
2. **Confirm** `pbv-signatures`, `form-submissions`, `pbv-applications` exist on prod and capture their exact `public` / `file_size_limit` / `allowed_mime_types` and any `storage.objects` policies.
3. **Do not invent config values.** The migration reproduces the live config. If the audit is unavailable, write the migration with the structural pattern + a clearly-commented `TODO: reconcile against live storage.buckets` and log to OPEN-DECISIONS that it must be reconciled before apply — do not guess MIME/size values and present them as final.
4. If the audit shows any of the three buckets is **genuinely missing on prod** (not just missing a migration), **STOP** — that's a BLOCKER (a real prod gap). Log it and report; do not auto-remediate prod.

---

## What this fixes (one sentence)

Only `pbv-forms` has a creation migration; `pbv-signatures`, `form-submissions`, `pbv-applications` were created live by hand — so a fresh environment provisioned from `supabase/migrations/` alone would 404 on every upload/download. Backfill them, modeled on `20260518000000_pbv_forms_storage_bucket.sql`.

## Branch / commit (per batch protocol)

- Work on `feat/pbv-launch-hardening`. No per-PRD branch.
- One commit: `PRD-69: backfill storage bucket creation migrations (pbv-signatures, form-submissions, pbv-applications)`.
- **Push after commit.**

## Shell + DB

- `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` (no code changes, but confirm the migration file doesn't break any migration-scanning build step). Never `npx tsc`.
- **Write the migration; do NOT apply it to prod (`lieeeqqvshobnqofcdac`).** It's a no-op on prod anyway (`ON CONFLICT DO NOTHING`; buckets exist). Add it to "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md` with the "no-op on existing prod; required for fresh environments" note.
- **Never** run a destructive statement against any DB.

---

## Step-by-step

### Step 0 — Read ground truth
Read `20260518000000_pbv_forms_storage_bucket.sql` (the exact pattern to copy), `20260513140000_post_approval_execution_storage.sql` (policy pattern, if the audit shows policies), and `lib/storage/resolveBucket.ts` (canonical bucket-name list). Read the audit Section 2 output.

### Step 1 — Write the migration
Create `supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql`:
- Header comment in the `20260518000000` style: created live by hand on prod; backfilled here for parity + fresh-env provisioning; no-op on prod via `ON CONFLICT (id) DO NOTHING`.
- `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (…) ON CONFLICT (id) DO NOTHING;` for the three buckets (single multi-row VALUES or one statement each), using the **live config from the audit**.
- Policies: include (modeled on `20260513140000`) only if the audit shows the live buckets have `storage.objects` policies; otherwise omit with the service-role-only comment from the `pbv-forms` migration.
- Bucket `id`/`name` must exactly match the code strings: `pbv-signatures`, `form-submissions`, `pbv-applications`.

### Step 2 — Log to OPEN-DECISIONS
Add the migration to "Prod migrations to apply" with: what it does, that it's a no-op on existing prod, that it's required for any fresh environment, and the source of each config value (the audit query).

### Step 3 — Static gates + build report + commit + push
Gates below. Build report at `docs/build-reports/69-pbv-storage-bucket-creation-migrations_build-report_2026-05-21.md` (record each bucket's config and where the value came from). Commit `PRD-69: …`. **Push.**

---

## Files to modify

| File | Change |
|---|---|
| `supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql` (new) | the backfill migration — **commit only, do NOT apply to prod** |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | add under "Prod migrations to apply" |

## Files NOT to touch

- `20260518000000_pbv_forms_storage_bucket.sql` and any code that reads/writes these buckets (read-only references).
- `tests/e2e/**`, `.github/workflows/**` — no Playwright/e2e.
- `.git/config` — leave it; log a BLOCKER if git genuinely errors.

---

## Verification gates (per PRD-69)

**Static (must pass before commit):**
- **Gate 1:** valid Postgres SQL; every INSERT is `ON CONFLICT (id) DO NOTHING` (re-runnable / safe no-op). If a local/scratch Supabase is handy, double-apply is a second-run no-op (optional — don't block on DB availability).
- **Gate 2:** the three bucket `id`s match the code strings (grep `from('pbv-signatures'`, `from('form-submissions'`, `from('pbv-applications'` and `lib/storage/resolveBucket.ts`).
- **Gate 3:** every config value (and policy) reconciled line-by-line against the audit Section 2 output; source noted in the build report.
- **Gate 4:** `tsc --noEmit` + `npm run build` clean.

**Not applicable:** no runtime UI gate. Fresh-environment provisioning is the only true end-to-end check — note it in the build report; do not block on standing up a new env.

## What "done" looks like

1. `PRD-69: …` commit on `feat/pbv-launch-hardening`, **pushed**; migration committed but **not applied**, listed in OPEN-DECISIONS.
2. Static gates green; config values traced to the audit.
3. The migration creates all three buckets idempotently, matching live config, modeled on the `pbv-forms` migration.

## What NOT to do

- **Do not stop to ask** — default-and-log (the one exception: a genuinely-missing-on-prod bucket is a BLOCKER → stop + log).
- **Do not invent** MIME/size/policy values — reproduce the audit's live config or flag for reconciliation.
- Do not apply the migration to prod. Do not run destructive SQL.
- Do not change the `pbv-forms` migration or any bucket-using code.
- **Do not add or run Playwright/e2e; do not touch `tests/e2e/**` or `.github/workflows/**`.**
- Do not use `npx tsc`. Do not "fix" `.git/config`.

## Reporting back (in the build report)

- Commit SHA; pushed; migration path (listed in OPEN-DECISIONS, not applied).
- A small table: each bucket → `public` / `file_size_limit` / `allowed_mime_types` / policies, with the audit query as the source.
- Whether any policies were encoded (and why), or omitted (service-role-only).
- Any BLOCKER (e.g. a bucket missing on prod) surfaced for Alex.
