# PRD-69 — Storage Bucket Creation Migrations (drift remediation)

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (continues the launch-hardening batch after PRD-68)
**Status:** Draft — ready for build
**Severity:** P1 — environment/provisioning drift, **not** a live-prod outage. Prod has these buckets (created live by hand); a fresh environment provisioned from `supabase/migrations/` alone would be missing them, and every upload/download would 404.
**Depends on:** Nothing functionally. Migration timestamp must sort after the latest existing migration (`20260521040000`).
**Source:** Tenant-facing code-level audit 2026-05-21 (Section 2). The **live-DB audit** (Supabase MCP) produces the authoritative bucket config this PRD's migration must reproduce.

---

## Problem Statement

Only `pbv-forms` has a creation migration (`supabase/migrations/20260518000000_pbv_forms_storage_bucket.sql`). Three buckets are referenced from tenant + admin code but have **no `INSERT INTO storage.buckets`** anywhere in `supabase/migrations/`:

| Bucket | Purpose | Referenced from (confirmed) |
|---|---|---|
| `pbv-signatures` | signature PNG images | `t/[token]/pbv-full-app/signature/capture/route.ts:82`, `sign-summary/route.ts:102`, `signer/[member_token]/signature/capture/route.ts:82`, `lib/pbv/signing/completeForm.ts:191,220` |
| `form-submissions` | tenant-uploaded documents (the default doc bucket) | `t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:182`, many admin upload/export routes, and `lib/storage/resolveBucket.ts:54` (default for all application docs) |
| `pbv-applications` | e-signed PDFs + HACH-shared docs | `t/[token]/pbv-full-app/signatures/route.ts:165`, `signature-thumbnails/route.ts:40`, `t/[token]/documents/[documentId]/route.ts:126`, `hach/documents/[id]/signed-url/route.ts:6` |

They were created **live in the prod project (`lieeeqqvshobnqofcdac`) by hand** — the `pbv-forms` migration's own header documents this as the established pattern ("Bucket was missing on hosted Supabase; created live via Storage Admin API … alongside this migration for parity"). [Confirmed in code 2026-05-21]

**Drift risk:** a new environment (staging clone, DR, local-from-scratch) provisioned from migrations alone has `pbv-forms` but not the other three → every tenant upload, signature capture, and signed-PDF read 404s. This is the same class of gap as the queued `tenant_lookup` table (no `CREATE TABLE` migration).

---

## Goals

1. A committed migration creates `pbv-signatures`, `form-submissions`, and `pbv-applications` in `storage.buckets`, modeled exactly on `20260518000000_pbv_forms_storage_bucket.sql`: `INSERT … ON CONFLICT (id) DO NOTHING` + a parity comment. Idempotent — a **safe no-op on prod** (the buckets already exist), correct on a fresh environment.
2. Each bucket's config (`public`, `file_size_limit`, `allowed_mime_types`) and any RLS policies on `storage.objects` **match the live prod config**, not invented values.
3. The migration is committed and listed under **"Prod migrations to apply"** in `OPEN-DECISIONS.md`, with a note that on the existing prod project it is a no-op (parity only) — its real job is fresh-environment provisioning.

## Non-goals

- **No** change to the `pbv-forms` bucket/migration or to any code that reads/writes these buckets.
- **No** applying the migration to prod (write-not-apply per batch protocol; it's a no-op there anyway).
- **No** new bucket, no bucket rename, no data movement between buckets.
- **No** invented config — every value traces to the audit's live query (see below).
- **No** Playwright/e2e; no change to `tests/e2e/**` or `.github/workflows/**`.

---

## The audit dependency (this PRD is gated on it)

The live-DB audit (Section 2) runs, against prod:

```sql
select id, name, public, file_size_limit, allowed_mime_types, created_at
  from storage.buckets order by created_at;
-- and, per bucket:
select * from pg_policies where schemaname='storage' and tablename='objects';  -- filtered per bucket
```

The migration **reproduces what that query returns** for `pbv-signatures`, `form-submissions`, `pbv-applications`:
- `public` flag exactly as live (expected `false` for all three — service-role access).
- `file_size_limit` exactly as live.
- `allowed_mime_types` exactly as live (or `NULL` if the live bucket has no MIME restriction).
- If the audit shows **policies** on `storage.objects` for any of these buckets, encode equivalent `CREATE POLICY` statements modeled on `20260513140000_post_approval_execution_storage.sql` (the "signing-packets" policy pattern the `pbv-forms` migration cites). If the audit shows **no** policies (service-role only — the `pbv-forms` precedent), the migration omits policies and carries the same explanatory comment.
- If the audit shows a bucket is **actually missing on prod** (not just missing a migration), that is a different, higher-severity finding — **STOP and log as a BLOCKER**; do not silently "fix" prod by writing a migration that hasn't been validated against intended config.

**Starting-point defaults (NOT authoritative — reconcile against the audit):** based on code usage, plausibly `pbv-signatures` = `image/png` (signature images, small limit), `form-submissions` = PDFs + common image types (tenant uploads, larger limit), `pbv-applications` = `application/pdf`. These are hypotheses to confirm/replace with the live values, not values to ship blind.

---

## Implementation (single migration)

Create `supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql` (timestamp sorts after the latest, `20260521040000`):

- A header comment in the style of `20260518000000` explaining: these buckets were created live by hand on prod; this migration backfills them for parity and fresh-environment provisioning; it is a no-op on prod via `ON CONFLICT (id) DO NOTHING`.
- One `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (…) ON CONFLICT (id) DO NOTHING;` per bucket (or a single multi-row `VALUES`), using the **live config values from the audit**.
- Policies: include only if the audit shows live policies (modeled on `20260513140000`); otherwise omit with the service-role-only comment from the `pbv-forms` migration.

Combined single migration (D1) — atomic and readable. The bucket `id`/`name` strings must match exactly what the code uses (`pbv-signatures`, `form-submissions`, `pbv-applications`).

---

## Verification / test plan

Static only. **No Playwright/e2e.** A bucket-creation migration cannot be meaningfully unit-tested in app code; verification is structural + audit-reconciliation.

### Static (must pass before commit)
- **Gate 1 (SQL valid + idempotent):** the migration parses as valid Postgres SQL and every `INSERT` uses `ON CONFLICT (id) DO NOTHING` (re-runnable, safe no-op on prod). Confirm by inspection; if a local/scratch Supabase is available, applying it twice is a no-op the second time (optional — do not block on local DB availability).
- **Gate 2 (names match code):** the three bucket `id`s in the migration exactly match the strings used in code — `grep -rn "from('pbv-signatures'\|from('form-submissions'\|from('pbv-applications'" app/ lib/` resolves to the same names. (resolveBucket's union in `lib/storage/resolveBucket.ts` is the canonical list.)
- **Gate 3 (config matches audit):** every `public` / `file_size_limit` / `allowed_mime_types` value (and any policy) is reconciled line-by-line against the audit's Section 2 output. Note the source of each value in the build report.
- **Gate 4 (build):** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean (no code changed, but confirm the migration file doesn't break any build step that scans `supabase/migrations/`). Use `node ./node_modules/typescript/bin/tsc`, never `npx tsc`.

### Not applicable / deferred
- No runtime UI gate. The only "runtime" check is on a fresh environment: provisioning from migrations creates all four buckets — defer to whenever a fresh env is next stood up; note in build report.

---

## Open questions

- **O1 (one migration vs three):** One combined migration (default — atomic, one file to apply/review) vs three separate files. Default: **one combined**. [Inference]
- **O2 (policies in migration vs live-managed):** Encode `storage.objects` policies in the migration only if the audit shows the live buckets have them; otherwise mirror the `pbv-forms` precedent (service-role only, no policies, explanatory comment). Default: **match the audit**. [Inference]
- **O3 (MIME/size source):** All values from the audit's live query; the "starting-point defaults" above are hypotheses only. If the audit is unavailable at build time, **do not invent values** — write the migration with a clearly-commented `TODO: reconcile against live storage.buckets` and log it as needing the audit before apply. [Inference]

## Decisions

- **D1:** One combined migration, modeled on `20260518000000_pbv_forms_storage_bucket.sql`, `ON CONFLICT (id) DO NOTHING` (idempotent; safe no-op on prod).
- **D2:** Config values come from the live-DB audit (Section 2), not invented.
- **D3:** Service-role-only (no public policies) unless the audit shows otherwise — matches the `pbv-forms` precedent; policy pattern (if needed) from `20260513140000_post_approval_execution_storage.sql`.
- **D4:** Write + commit; list under "Prod migrations to apply" in `OPEN-DECISIONS.md`, flagged "no-op on existing prod (buckets exist); required for fresh environments."
- **D5:** If the audit shows any of the three buckets is genuinely **missing** on prod, that is a BLOCKER (a real prod gap, not just migration drift) — stop and surface it; do not auto-remediate prod.

---

## Files expected to change

| File | Change |
|---|---|
| `supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql` (new) | create `pbv-signatures`, `form-submissions`, `pbv-applications` with live-matched config; ON CONFLICT DO NOTHING; **commit only — do NOT apply to prod** |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | add the migration under "Prod migrations to apply" with the no-op-on-prod note |

If anything outside this list needs changing, take the safe default and log it rather than expanding scope.
