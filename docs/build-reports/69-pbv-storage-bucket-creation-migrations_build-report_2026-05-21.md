# Build Report — PRD-69: Storage Bucket Creation Migrations (drift remediation)

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening` (continues 62–68)
**Commit:** `407f556` (pushed to `origin/feat/pbv-launch-hardening`)
**Status:** ✅ Static gates green; migration written + committed, **NOT applied** (per batch protocol). Listed under "Prod migrations to apply" in `OPEN-DECISIONS.md` with reconcile-before-fresh-env-apply checklist.

---

## Premise — confirmed in code (live-DB audit unavailable in-session)

The live-DB verification audit referenced in the prompt (Supabase MCP project
`lieeeqqvshobnqofcdac`, Section 2 — `select * from storage.buckets …`) was not
present at `docs/audits/` at build time. Per the PRD-69 prompt's fallback
("If the audit is unavailable, write the migration with the structural pattern
+ a clearly-commented `TODO: reconcile against live storage.buckets` and log
to OPEN-DECISIONS that it must be reconciled before apply — do not guess
MIME/size values and present them as final"), confirmed against code:

- **No creation migration exists** for `pbv-signatures`, `form-submissions`,
  or `pbv-applications` anywhere in `supabase/migrations/`. The only PBV
  bucket-creation migration is `20260518000000_pbv_forms_storage_bucket.sql`
  (for `pbv-forms`); `20260513140000_post_approval_execution_storage.sql`
  covers `signing-packets`. The 4 unrelated grep hits in `supabase/migrations/`
  for `pbv-applications` etc. are RBAC role/workflow strings, not bucket
  inserts.
- **All three buckets are actively referenced in app/lib code** (per Gate 2
  grep below): 8 files reference `pbv-signatures`, 13 files reference
  `form-submissions`, 5 files reference `pbv-applications`. Drift is real.
- The `pbv-forms` migration header explicitly documents the pattern these
  three buckets followed: "Bucket was missing on hosted Supabase; created
  live via Storage Admin API … alongside this migration for parity."

Premise stands: drift confirmed. No bucket is "genuinely missing on prod"
that we can detect from code (which would be the BLOCKER condition); the
audit would be the authoritative source for that, and is unavailable.

---

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql` (new) | One multi-row `INSERT INTO storage.buckets … ON CONFLICT (id) DO NOTHING;` for `pbv-signatures`, `form-submissions`, `pbv-applications`. `public=false` for all (service-role precedent); `file_size_limit=NULL` and `allowed_mime_types=NULL` with a prominent **RECONCILE BEFORE FRESH-ENV APPLY** comment block. No `storage.objects` policies (mirrors `pbv-forms` service-role-only precedent). |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | New entry under "Prod migrations to apply" with the full reconcile checklist (the exact prod query to run, the rationale for NULL/permissive defaults, and the "no-op on prod / required for fresh env" framing). |

**Migration timestamp:** `20260521050000` sorts after the latest existing migration `20260521040000` (PRD-66). ✓

**Did NOT apply to prod.** No SQL executed against any database in this session.

---

## Per-bucket config

| Bucket | `public` | `file_size_limit` | `allowed_mime_types` | Policies | Source |
|---|---|---|---|---|---|
| `pbv-signatures`   | `false` | `NULL` (no Postgres cap) | `NULL` (no Postgres filter) | none (service-role) | NULL/permissive default — **MUST reconcile with audit before fresh-env apply** |
| `form-submissions` | `false` | `NULL` (no Postgres cap) | `NULL` (no Postgres filter) | none (service-role) | NULL/permissive default — **MUST reconcile with audit before fresh-env apply** |
| `pbv-applications` | `false` | `NULL` (no Postgres cap) | `NULL` (no Postgres filter) | none (service-role) | NULL/permissive default — **MUST reconcile with audit before fresh-env apply** |

`public=false` is the only value that did not come from the audit — it is
inferred from the unanimous PBV precedent (`pbv-forms` is `false`,
`signing-packets` is `false`; all PBV buckets are accessed exclusively via the
service role from API routes). If the audit shows any of the three is actually
public, that would be a surprising deviation worth flagging.

`file_size_limit=NULL` and `allowed_mime_types=NULL` are intentional
fresh-env-permissive defaults so the migration doesn't ship invented limits
that could silently break uploads on a freshly-provisioned environment.
Existing app-side validation in the upload handlers still enforces app-level
limits regardless.

Why no policies: `pbv-forms` (`20260518000000`) set the precedent — all
service-role access, no `storage.objects` policies, because requests come
from `supabaseAdmin` in API routes. If the audit reveals the live buckets do
have `pg_policies` rows on `storage.objects`, add equivalent `CREATE POLICY`
blocks (modeled on `signing-packets` in `20260513140000`) before the
fresh-env apply.

---

## Static gates — all green ✅

| Gate | Result | Notes |
|---|---|---|
| Gate 1: valid Postgres SQL; every INSERT uses `ON CONFLICT (id) DO NOTHING` (re-runnable / safe no-op) | ✅ | Single combined INSERT with three VALUES rows. Idempotent; safe to re-run. |
| Gate 2: bucket `id`s match code strings | ✅ | `from('pbv-signatures')` in 8 files (`lib/pbv/signing/completeForm.ts`, 5 API routes, 2 e2e helpers). `from('form-submissions')` in 13 files (resolveBucket default + 7 upload/export routes + docs). `from('pbv-applications')` in 5 files (3 sign/thumbnail/document routes + 2 docs). `lib/storage/resolveBucket.ts` union (`KnownBucket`) lists all three explicitly. |
| Gate 3: config values reconciled against audit | ⚠ DEFERRED — audit unavailable. Defaults documented; reconcile checklist in OPEN-DECISIONS + inline migration comment. | Safe for prod (`DO NOTHING`); MUST reconcile before fresh-env apply. |
| Gate 4: `tsc --noEmit` + `npm run build` clean | ✅ | exit 0 both; build completes; manifest unchanged (migration file added, no code touched). |

No Playwright/e2e added or run. `tests/e2e/**` and `.github/workflows/**`
untouched.

---

## Deferred runtime gates (manual Chrome walk / fresh-env provisioning — NOT Playwright)

Listed for the post-run verification pass. **Do not block on these in-session.**

- **Fresh-env provisioning (the only real end-to-end check):** stand up a new
  Supabase project from `supabase/migrations/` alone; confirm all four PBV
  buckets (`pbv-forms`, `pbv-signatures`, `form-submissions`, `pbv-applications`)
  appear in `storage.buckets` and that a representative tenant upload,
  signature capture, and signed-PDF read all succeed end-to-end. This was
  the gap PRD-69 fills.
- **Audit reconciliation (before any fresh-env apply for production use):**
  run the prod query in the OPEN-DECISIONS entry and update the migration's
  `VALUES` so fresh-env config matches prod.

---

## Decisions logged to OPEN-DECISIONS

- **D1 (one combined migration):** single multi-row INSERT — atomic, one
  file to apply/review. Default per O1.
- **D2 (config source):** NULL/permissive for `file_size_limit` and
  `allowed_mime_types` because the audit was unavailable. Reconcile checklist
  in OPEN-DECISIONS + inline migration comment.
- **D3 (no policies):** mirrors `pbv-forms` service-role-only precedent;
  add per-bucket policies only if the audit reveals live ones.
- **D4 (write-not-apply):** migration committed; listed under "Prod
  migrations to apply" with the "no-op on existing prod; required for fresh
  environments" note.
- **D5 (genuinely-missing-on-prod BLOCKER):** not triggered — the audit was
  unavailable, so neither confirmed nor disproven. If a fresh audit later
  shows any of these three is actually missing on prod (not just missing a
  migration), that becomes a separate BLOCKER (real prod gap) and this
  migration's write-don't-apply posture would need to flip to a deliberate
  apply-on-prod after Alex review of the intended config.

---

## Cross-PRD flags

None. PRD-69 is structural drift remediation; no code path changes. Does not
interact with PRD-68 (separate route fix) or PRD-70 (UX polish).

The "audit unavailable → permissive defaults + reconcile checklist" posture
is the most defensible choice given the prompt's explicit "do not invent
values" rule and the prompt's allowed fallback ("If the audit is unavailable,
write the migration with the structural pattern + a clearly-commented TODO
… do not guess MIME/size values"). The migration is **safe for prod** today
(it's a no-op there); it just isn't authoritative for fresh-env config until
the audit values are filled in.
