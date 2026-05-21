# Windsurf Build Prompt — PRD-66: Regenerate-Lock & Launch Hardening

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs decision-handling (default-and-log, never stop to ask), prod-migration safety (write + commit + list, do not apply), and static-vs-deferred gates.

Build from `docs/fullApp-Plan/66-pbv-regenerate-lock-and-hardening_prd_2026-05-21.md`. Read it next.

This implements the **remaining** audit findings **#5, #11, #9, #13** from `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` — the items not taken by PRDs 62/63/64. `generate-forms` can overwrite the unsigned PDF a signer is mid-ceremony on (#5); the signed-PDF path has no version/ceremony suffix so a restarted ceremony clobbers the prior artifact (#11); idempotency isn't scoped by `application_id` (#9); `tryLoadPdf` swallows real errors (#13). PRD-66 versions the unsigned path (migration adds `generation_version`), versions the signed path by `ceremony_id`, scopes idempotency, and makes `tryLoadPdf` surface non-`ENOENT` errors.

---

## Branch / commit (same post-finalization batch as PRD-62)

- Continue on **`feat/pbv-launch-hardening`** — the branch PRD-62 created (off `feat/pbv-full-finalization`, or `main` if that had already merged). Do **not** create a per-PRD branch.
- **One commit** when done: `PRD-66: regenerate-lock + hardening`. **Push after commit.**
- Follow `BATCH-RUN-PROTOCOL.md` for PR handling.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD adds a column (`pbv_form_documents.generation_version`). **Write + commit the migration; do NOT apply it to prod (`lieeeqqvshobnqofcdac`).** Add it to "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`.
- `.git/config` is fine — do not "fix" it. Never run destructive SQL.

---

## What's confirmed in code (line refs verified 2026-05-21)

- Unsigned upload: `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:143-149` (`upsert:true`, path `…-${language}-unsigned.pdf`); form-doc upsert at `:166-189` (PRD-62 also writes `unsigned_pdf_hash` here).
- Signer hash source: `lib/pbv/signing/completeForm.ts:118-129` (`document_hash` = sha256 of the downloaded unsigned PDF).
- Signed-PDF write: `completeForm.ts:238-245` (`…-signed.pdf`, `upsert:true`). PRD-62 deletes the HOH-route copy at `sign-form/route.ts:282-289`, so post-62 `completeForm.ts` is the only signing-completion site. `ceremonyId` is already a `CompleteFormOptions` field (`:24`).
- Idempotency lookup: `lib/idempotency.ts:17-22` filters `key`+`endpoint`; `application_id` written at `:30-37`, never read in WHERE.
- `tryLoadPdf`: `lib/pbv/form-generation/source-pdfs.ts:34-40` — empty `catch { return null; }`. `loadPdf` throws a generic `Error('Source PDF not found: …')` when `existsSync` is false (`:28-29`).
- `signing_status` enum is `('not_started','summary_signed','in_progress','complete')` (`20260515000000_pbv_form_execution_columns.sql:37`). `pbv_form_documents` has neither `generation_version` nor `unsigned_pdf_hash` pre-migration.

---

## Step-by-step

### Step 0 — Confirm the refs (and PRD-62's landing)
Open the files above. Confirm PRD-62 already collapsed the HOH `sign-form` route onto `completeFormSigning` and added `unsigned_pdf_hash` + finalize Check 5. If PRD-62 has **not** landed (unexpected — 62 runs first), apply the #11 signed-path change to **both** `completeForm.ts:238-245` and `sign-form/route.ts:282-289`, and note `[Unverified]` in the build report. Default: only `completeForm.ts` changes.

### Step 1 — Version the unsigned PDF (#5, durable variant)
- **Migration** `supabase/migrations/<UTC-ts>_prd66_form_generation_version.sql` (mirror `20260521000000_prd55b_form_sourcing_corrections.sql` header/comment style): `ALTER TABLE public.pbv_form_documents ADD COLUMN IF NOT EXISTS generation_version INTEGER NOT NULL DEFAULT 1;` + a `COMMENT ON COLUMN` noting it's the monotonic regeneration counter, bumped each time generate-forms re-stamps a form mid-signing. **Commit only; list in OPEN-DECISIONS; do not apply.**
- **generate-forms** (`generate-forms/route.ts`): before stamping each `(form_id, language)`, query the existing `pbv_form_documents` row for `generation_version` + `collected_signer_member_ids`. Decide the version:
  - No existing row → `generation_version = 1`.
  - Row exists with **zero** collected signers → keep the existing `generation_version`; `upsert:true` is fine (no signer committed to those bytes).
  - Row exists with **≥1** collected signer → `generation_version = existing + 1` (the regenerate-during-signing case).
  - Build the unsigned path with the suffix: `pbv/${fullApp.id}/forms/${formId}-${language}-v${generationVersion}.pdf` (replaces `:143`). Use `upsert:false` when the version was bumped (new path; clobber should fail loudly), `upsert:true` for the same-version re-stamp.
  - Add `generation_version` to the `pbv_form_documents` upsert (`:166-189`) alongside the versioned `unsigned_pdf_path` and PRD-62's `unsigned_pdf_hash`.
- **No new `pbv_signature_events` column.** Version enforcement rides PRD-62's `unsigned_pdf_hash` Check 5: bumping the version rewrites `unsigned_pdf_hash`, so the in-flight signer's event hash no longer matches and finalize already blocks with "hash mismatch — please re-sign." Do **not** add a redundant finalize check. Log this choice (O2) to OPEN-DECISIONS.

### Step 2 — Version the signed PDF path (#11)
- In `lib/pbv/signing/completeForm.ts`: change the signed path (`:238`) to `pbv/${appId}/forms/${formDoc.form_id}-${formDoc.language}-${ceremonyId}-signed.pdf`. Change the upload (`:240-245`) to `upsert: false`.
- Keep `formDocUpdate.signed_pdf_path` (`:248`) pointing at the just-written latest path; older `…-${priorCeremony}-signed.pdf` objects stay in storage.
- If `upsert:false` fails because the exact same `(ceremony_id, form)` path already exists (a genuine idempotent replay of the same ceremony), treat it as already-written: re-point `signed_pdf_path` at it, don't throw. A different ceremony produces a different path, so cross-ceremony clobber can't happen.

### Step 3 — Scope idempotency by `application_id` (#9)
- In `lib/idempotency.ts`, add `.eq('application_id', applicationId)` to the existing-row query (between `.eq('endpoint', endpoint)` and `.maybeSingle()`, `:17-22`). No migration. Pre-existing rows without a matching `application_id` simply miss the cache and the (idempotent) handler re-runs.

### Step 4 — `tryLoadPdf` error inspection (#13)
- In `lib/pbv/form-generation/source-pdfs.ts:34-40`, replace the empty catch. If `err.code === 'ENOENT'` **or** the message matches `loadPdf`'s thrown "Source PDF not found" → return `null` silently (intentional unsourced-form path). For any other error → `console.error('[source-pdfs] Failed to load <fileName>:', err)` and still `return null` so module import / the request doesn't crash.

### Step 5 — Static gates + build report + commit + push
- Write the tests in the PRD's "Files expected to change": unsigned version bump on in-flight regenerate (and no bump with zero signers); signed path carries `ceremony_id` + `upsert:false`; idempotency lookup scoped by `application_id` (+ cross-tenant key miss); `tryLoadPdf` ENOENT-silent vs other-error-logs-ERROR. Extend PRD-62's `completeForm.test.ts` rather than duplicating it.
- `node ./node_modules/typescript/bin/tsc --noEmit`, then `npm run build`, then `vitest run` — all clean/green.
- Build report at `docs/build-reports/66-pbv-regenerate-lock-and-hardening_build-report_2026-05-21.md`.
- Commit `PRD-66: regenerate-lock + hardening`. Push.

---

## Files to modify

| File | Change |
|---|---|
| `supabase/migrations/<ts>_prd66_form_generation_version.sql` | add `pbv_form_documents.generation_version` — **commit only, list in OPEN-DECISIONS, do not apply** |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | read existing version + collected signers; bump on in-flight regenerate; versioned unsigned path + `upsert:false` on bump; write `generation_version` to the upsert |
| `lib/pbv/signing/completeForm.ts` | signed path suffixed with `ceremony_id`; `upsert:false`; benign same-path replay handling |
| `lib/idempotency.ts` | add `.eq('application_id', applicationId)` to the existing-row lookup |
| `lib/pbv/form-generation/source-pdfs.ts` | `tryLoadPdf` inspects error: ENOENT/not-found → null silent; else log ERROR + null |
| `app/api/t/[token]/pbv-full-app/__tests__/generate-forms-versioning.test.ts` (new) | version bump on in-flight regenerate; no bump with zero signers |
| `lib/pbv/__tests__/completeForm.test.ts` | signed path carries `ceremony_id`; `upsert:false` (extend PRD-62's file) |
| `lib/__tests__/idempotency.test.ts` (new) | lookup scoped by `application_id`; cross-tenant key miss |
| `lib/pbv/form-generation/__tests__/source-pdfs.test.ts` (new) | ENOENT silent; other error logs ERROR |

## Files NOT to touch

- Signing-flow structure / `completeFormSigning` internals beyond the signed-path suffix + version threading (PRD-62 owns unification + `unsigned_pdf_hash`).
- `X-Assisted-By` (#4), atomic finalize event (#10) — PRD-64. Conditional/resolver fail-closed (#7/#14) — PRD-63.
- `stampForm`, summary doc, intake, documents UI. No "discard & regenerate" UI — flag it (O3), don't build it.
- Do not add a `pbv_signature_events` column — version enforcement rides PRD-62's hash Check 5.

---

## Verification gates (per PRD-66)

**Static (must pass in-session before commit):**
- **Gate 1:** generate-forms writes `-v2.pdf` + `generation_version=2` when the row has ≥1 collected signer; no bump with zero signers.
- **Gate 2:** signed-PDF upload path contains `ceremony_id`; upload called with `upsert:false`.
- **Gate 3:** idempotency lookup includes `.eq('application_id', …)`; a same-key request for a different `application_id` doesn't return the cached response.
- **Gate 4:** `tryLoadPdf` returns null silently on ENOENT; returns null **and** logs ERROR (with file name) on any other error.
- **Gate 5:** `tsc --noEmit` + `npm run build` clean; `vitest run` green.

**Deferred to the post-run pass (list in build report, do NOT block):**
- **R1:** deploy + apply migration; sign one signer of a multi-signer form, move `intake_status` back to `in_progress`, re-run generate-forms → unsigned path is `-v2`, `generation_version=2`, finalize blocks with the PRD-62 hash-mismatch re-sign message.
- **R2:** restart a ceremony for a fully-signed form → prior `…-${ceremony}-signed.pdf` still in storage alongside the new one; `signed_pdf_path` points at the new one.

---

## What "done" looks like

1. `PRD-66: regenerate-lock + hardening` commit on `feat/pbv-launch-hardening`, pushed; migration committed + listed in OPEN-DECISIONS (not applied).
2. Unsigned PDF path versioned; `generation_version` bumps on in-flight regenerate; finalize blocks via PRD-62's hash check when bytes diverge.
3. Signed PDF path carries `ceremony_id` with `upsert:false`; prior artifacts retained.
4. Idempotency scoped by `application_id`; `tryLoadPdf` logs non-ENOENT errors.
5. Static gates green; build report written with deferred R1–R2 + decisions (D1–D5, O1–O3) listed.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol (the zero-signer no-bump rule O1, the no-extra-column choice O2, the no-UI flag O3).
- Do not apply the migration to prod. No destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config`.
- Do not add a `pbv_signature_events` column or a redundant finalize check — rely on PRD-62's Check 5.
- Do not pull in out-of-scope findings (#1–#4, #6–#8, #10, #12, #14).

## Reporting back (in the build report)

- Commit SHA; pushed yes/no; migration path (listed in OPEN-DECISIONS); confirmation PRD-62 had landed (or the `[Unverified]` dual-edit fallback used).
- Confirmation: unsigned path versioned + `generation_version` written; signed path carries `ceremony_id` + `upsert:false`; idempotency scoped; `tryLoadPdf` logs non-ENOENT.
- Static gate results; any `[Unverified]` line-ref drift from Step 0.
- Decisions D1–D5 + O1–O3 logged to OPEN-DECISIONS; deferred R1–R2 for the post-run pass.

This is the last of the audit-fix PRDs (the remaining #5/#11/#9/#13 not covered by 62/63/64); proceed per the batch order.
