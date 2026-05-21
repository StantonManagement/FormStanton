# Session Handoff — PBV Launch-Hardening (PRDs 68–70) + git recovery

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening` — tip `4c62436`, clean working tree, pushed (`git ls-remote origin` == local; verified).
**Paste this whole file into the next chat to restore context.**

---

## TL;DR

The 68–70 launch-hardening batch is committed and on GitHub. A mid-session `.git` index corruption was recovered. Three open decisions were cleared this session. Six migrations are written but **not yet applied** — apply-runbook is below. No PR opened yet. Pre-merge verification is the manual Chrome walk, not the static gates (those are green).

---

## Current repo / git state

- `feat/pbv-launch-hardening` history (top): `4c62436` (docs SHA backfill) → `4c43cfe` PRD-70 → `407f556` PRD-69 → `ad33f52` PRD-68 → `f1789e1` PRD-67 → …
- Local branch tip and `origin/feat/pbv-launch-hardening` both at `4c624360` — push confirmed against the live remote.
- Working tree clean (index rebuilt: 1678 entries).

### What happened to git (so it doesn't surprise the next session)
The local `.git/index` corrupted from a crash mid-session (`git status` / `git rev-parse HEAD` errored; `fsck` showed corrupt index, a null `origin/HEAD`, and a bad `HEAD` reflog). Commit objects and the branch ref were never affected. Recovery: `origin/HEAD` and the reflog were repaired from the sandbox; the corrupt index + a stale `index.lock` were cleared by Alex on his **native Windows** terminal (`del .git\index .git\index.lock` then `git read-tree HEAD`). Note for next time: `.git` index/lock repair cannot be done from the Cowork Linux sandbox — the Windows-folder mount returns inconsistent metadata. Read-only git (`log`, `rev-parse <ref>`, `cat-file`, `ls-remote`) and ref writes are fine from the sandbox; index/lock repair goes to Alex's terminal.

---

## What shipped this batch (68–70)

| PRD | Commit | What |
|---|---|---|
| **68** (P0) | `ad33f52` | Fixed the member-token signer forms route — replaced 3 phantom columns (`display_name`, `*_count`) with `*_member_ids` arrays + a `pbv_form_templates` fetch + JS-side counts (mirrors the working HOH route). Extracted pure `mapSignerForms` helper → `lib/pbv/signer-forms-mapping.ts`; 11 vitest tests. Response shape unchanged. |
| **69** (P1) | `407f556` | Backfill creation migration for storage buckets `pbv-signatures`, `form-submissions`, `pbv-applications` (created live on prod, never had a migration → fresh envs 404'd). Written + committed, **not applied**. No-op on existing prod (`ON CONFLICT (id) DO NOTHING`); permissive `NULL` size/mime defaults with a reconcile-before-fresh-env checklist (live-DB audit was unavailable at build time). |
| **70** (P3) | `4c43cfe` | Tenant-flow UX gaps. Gap A: unit-save PATCH failure now shows an inline EN/ES/PT error and halts navigation (no silent corruption of HoH building/unit). Gap B: documents data-fetch errors refetch via `fetchDocuments`; bootstrap/pageView errors keep PRD-67's intentional `window.location.reload()`. Pure helpers in `lib/pbv/tenant-flow-handlers.ts`; 11 vitest tests. |

**Static gates (all green per PRD):** `tsc --noEmit` clean, `npm run build` clean, vitest 68=11/11 and 70=11/11 (69 is migration-only). No Playwright/e2e added or modified; `tests/e2e/**` and `.github/workflows/**` untouched. The `E2E Tenant Flow` GitHub check is ignored per the batch prompt.

---

## Decisions cleared this session (recorded in OPEN-DECISIONS.md → "Resolutions … session 2")

1. **insurance_settlement + cd_trust_bond → tenant-attested "I have this, send me the form."** Not vestigial (keep the rows), not auto-generated. The 55b migration's `generation_enabled=FALSE` for both stays correct. Intended behavior: a tenant yes/no prompt; on "yes," flag the app so the office sends the form (or opens an upload slot). **Needs a scoped follow-up PRD.**
2. **eiv_guide_receipt → keep generating.** 55b's `generation_enabled=TRUE` is correct; no change.
3. **Migrations → none applied yet.** Apply-runbook below.
4. **68–70 defaults confirmed:** PRD-68 return-all-forms (HOH parity), `preferred_language → doc.language → 'en'`, PT-display-name deferred to a shared follow-up; PRD-70 halt+inline-error (Gap A) and surgical Gap B with PRD-67 reload preserved.

---

## Migration apply-runbook (apply WITH this branch's deploy, in timestamp order)

These six are committed on the branch but **NOT applied**. PRD-55's `20260520000000` is already applied. Apply in ascending timestamp order; the two code-coupled ones (64, 66) must land before the deployed code serves traffic or those routes 500.

| Order | Migration | What | Caveat |
|---|---|---|---|
| 1 | `20260521000000_prd55b_form_sourcing_corrections.sql` | Re-enables `criminal_background_release` + `eiv_guide_receipt` (sign); disables `insurance_settlement` + `cd_trust_bond` | Aligns with decisions #1/#2 above. Safe. |
| 2 | `20260521010000_prd62_unsigned_pdf_hash.sql` | Adds `pbv_form_documents.unsigned_pdf_hash` (nullable) for finalize Check 5 | Additive; legacy null rows skip Check 5 (no retroactive block — confirmed acceptable). |
| 3 | `20260521020000_finalize_pbv_application_fn.sql` | `finalize_pbv_application(...)` SECURITY DEFINER fn (atomic submit + event) | **Apply BEFORE the PRD-64 code serves traffic** — route calls the RPC; missing fn → every finalize 500s. |
| 4 | `20260521030000_prd65_government_id_required.sql` | Adds required `government_id` template + backfills in-progress apps | **Tenant-comms heads-up:** in-flight tenants see a NEW required Photo ID slot on next visit. Send the heads-up before applying if wanted. |
| 5 | `20260521040000_prd66_form_generation_version.sql` | Adds `pbv_form_documents.generation_version` (DEFAULT 1); unsigned path suffixed `-v{n}.pdf` | **Apply BEFORE the PRD-66 code serves traffic** — route writes the column; missing → generate-forms 500s. |
| 6 | `20260521050000_prd69_pbv_storage_buckets_backfill.sql` | Backfills the 3 storage buckets | **No-op on existing prod** (buckets exist; `DO NOTHING`). For a fresh env, RECONCILE `file_size_limit` / `allowed_mime_types` / policies against live `storage.buckets` first (query is in OPEN-DECISIONS.md). |

Rollbacks for each are in `OPEN-DECISIONS.md` under "Prod migrations to apply."

---

## Pre-merge verification (manual Chrome walk — NOT Playwright)

- **PRD-68 R1:** with a real unexpired `magic_link_token`, `GET /api/pbv-full-app/signer/{member_token}/forms` returns 200 (the call that 500s pre-fix). **R2:** the signer page renders the forms list, per-form name/counts/CTA matching HOH.
- **PRD-69:** stand up a fresh Supabase project from `supabase/migrations/` alone; confirm all four PBV buckets exist and a tenant upload + signature capture + signed-PDF read succeed. Reconcile bucket config against the prod audit before any fresh-env production apply.
- **PRD-70 R1 (Gap A):** force a unit PATCH failure → EN/ES/PT error renders above Start, button re-enabled, tenant stays put; successful retry navigates. **R2 (Gap B):** block the documents fetch → "Try again" recovers via refetch (SPA state preserved); kill the bootstrap endpoint → "Try again" still does a full reload.

---

## Standing launch-bar defaults (non-blocking unless changed)

- ES/PT summary/consent prose ships best-effort (Alex: "just put your best there"); native ES/PT review is post-launch, non-blocking.
- Finalize skips Check 5 for legacy `unsigned_pdf_hash IS NULL` rows (no retroactive block).
- Trilingual prod-token walk is read-only on prod (stop short of `/finalize`); full submit only on a non-prod app.
- PT display-name placeholder leakage is logged as Polish/deferred, not a blocker.

---

## Follow-up PRDs to schedule

- **insurance_settlement / cd_trust_bond tenant-attested prompt + office-send** (from decision #1 this session).
- **PT display-name** across signer + HOH routes and other template-name read sites (PRD-68 O3).
- **Post-complete intake editing** (PRD-67 deferred): the regenerate-on-edit confirmation + signing-reset interaction, with its own test plan.
- **"Discard signatures & regenerate" tenant UI** (PRD-66 O3) so a mid-signing version bump isn't a silent surprise.
- **Polish:** hub progress indicator (U7), leave-with-missing confirmation (U11).
- **Test-suite cleanup:** ~10 pre-existing baseline vitest failures, incl. `field-mapping.test` still referencing `briefing_docs_certification` (renamed `briefing_cert` in PRD-55).

---

## Immediate next action

1. Decide PR for 68–70 (not opened yet — Alex's call per the batch prompt).
2. Apply the six migrations per the runbook as part of the branch deploy.
3. Run the manual Chrome-walk gates above.

**Working context:** Cowork plans + verifies; Windsurf builds (PRDs in `docs/`, not code, except explicit build batches like this one). Supabase project `lieeeqqvshobnqofcdac` ("Tenant Communication"). China Wall (HACH) is app-layer and non-negotiable. Decision log: `docs/fullApp-Plan/OPEN-DECISIONS.md`. Build reports: `docs/build-reports/{68,69,70}-*.md`.
