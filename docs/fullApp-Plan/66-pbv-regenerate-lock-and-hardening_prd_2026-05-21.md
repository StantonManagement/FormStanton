# PRD-66 — PBV Regenerate-Lock & Launch Hardening

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (the post-finalization batch — created by PRD-62)
**Status:** Draft — ready for build
**Severity:** P1 — data-integrity (regenerating a packet mid-signing can detach the signed `document_hash` from the bytes that were signed) + defense-in-depth hardening
**Depends on:** PRD-62 (signing unification + `unsigned_pdf_hash`). PRD-62 collapses the HOH `sign-form` route onto `lib/pbv/signing/completeForm.ts` and removes the route-local signed-PDF upload, so #11 lands in `completeForm.ts`. PRD-66 runs after 62/63/64 on the same branch.
**Source:** `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` — this PRD implements the **remaining** audit findings **#5, #11, #9, #13** (the audit's PR-D + the leftover items of PR-E not taken by PRD-64). It does **not** touch #1–#3, #6, #8, #12 (PRD-62), #7/#14 (PRD-63), or #4/#10 (PRD-64).

---

## Problem Statement

After PRD-62 closed the audit-trail gap, four items remain — the regenerate-during-signing hazard and three small hardenings:

- **#5 — `generate-forms` overwrites the unsigned PDF in-flight.** `generate-forms/route.ts:143-149` uploads the regenerated unsigned PDF with `upsert: true`, with no guard against running mid-signing. A signer's flow is "download unsigned → hash it (`document_hash`) → sign → server stamps onto the unsigned bytes." If `generate-forms` runs *between* a signer's hash and another signer's hash (multi-signer forms like `hud_9886a`), the two `document_hash` values diverge for the same form; PRD-62's finalize Check 5 then blocks finalize on a hash mismatch the tenant can't diagnose. `generate-forms` is gated on `intake_status='complete'`, but `intake_status` can move back to `in_progress` if the tenant edits intake, so nothing stops a second run. [Confirmed in code 2026-05-21]
- **#11 — signed-PDF path has no version/ceremony suffix.** The signed PDF is written to `pbv/${appId}/forms/${form_id}-${language}-signed.pdf` with `upsert: true` (`completeForm.ts:238-245`; the HOH-route copy at `sign-form/route.ts:282-289` is deleted by PRD-62). If a ceremony is restarted (e.g. after a deliberate regenerate), the new signed PDF overwrites the prior one — the `pbv_signature_events` log shows two ceremonies, storage shows one artifact. Audit-trail incompleteness. [Confirmed]
- **#9 — idempotency lookup not scoped by `application_id`.** `lib/idempotency.ts:17-22` filters the existing-row query on `key` + `endpoint` only, though the table has `application_id` (written at `:30-37`, never read in WHERE). If a tenant's `Idempotency-Key` is ever guessable/reused, another tenant could replay the cached response. One-line hardening, no migration. [Confirmed]
- **#13 — `tryLoadPdf` empty catch swallows real errors.** `source-pdfs.ts:34-40` catches *any* error (missing file, permission denied, EMFILE) and returns `null`. A genuine operational failure is indistinguishable from "this form isn't sourced" — silent, nothing alerts. [Confirmed]

PRD-66 versions the unsigned-PDF path so a regenerate can't silently rewrite bytes a signer committed to, versions the signed-PDF path so a restarted ceremony keeps the prior artifact, scopes idempotency by `application_id`, and makes `tryLoadPdf` surface non-`ENOENT` errors.

---

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) | Fix shape |
|---|---|---|---|
| #5 | `generate-forms` overwrites the in-flight unsigned PDF; no regenerate guard | `generate-forms/route.ts:143-149` (`upsert:true`), `:166-189` (upsert row) | version the unsigned path `…-v${generationVersion}.pdf`; store `generation_version` on `pbv_form_documents`; bump on regenerate; signature events carry the version; finalize validates version match |
| #11 | signed-PDF path unversioned, `upsert:true` — restarted ceremony clobbers prior signed PDF | `lib/pbv/signing/completeForm.ts:238-245` | suffix path with `ceremony_id`; `upsert:false`; `signed_pdf_path` points at latest, older paths retained for audit |
| #9 | idempotency lookup scoped by `(key, endpoint)` only | `lib/idempotency.ts:17-22` | add `.eq('application_id', applicationId)` to the existing-row query — no migration |
| #13 | `tryLoadPdf` empty catch swallows all errors | `lib/pbv/form-generation/source-pdfs.ts:34-40` | inspect the error: `ENOENT` → `null` (intentional); else log as ERROR with form/file context, still return `null` |

`generation_version` is a **new, separate column** from PRD-62's `unsigned_pdf_hash` — the hash is "what bytes were signed," the version is "which regeneration produced them." Both can coexist on a row. [Confirmed — `pbv_form_documents` has neither today, migration `20260515010000`]

The `signing_status` enum on `pbv_full_applications` is `('not_started', 'summary_signed', 'in_progress', 'complete')` (`20260515000000_pbv_form_execution_columns.sql:37`). [Confirmed]

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Unsigned upload | `generate-forms/route.ts:143-149` | `…-${language}-unsigned.pdf`, `upsert:true`; no version, no signing guard |
| Form-doc upsert | `generate-forms/route.ts:166-189` | onConflict `full_application_id,form_id,language`; PRD-62 also writes `unsigned_pdf_hash` here |
| Signer hash source | `completeForm.ts:118-129` | downloads `unsigned_pdf_path`, `sha256` → `document_hash` |
| Signed-PDF write | `completeForm.ts:238-245` | `…-signed.pdf`, `upsert:true`; the HOH-route copy (`sign-form/route.ts:282-289`) is removed by PRD-62 |
| `ceremony_id` | `sign-form/route.ts:55`, passed into `completeForm.ts:24` | UUID grouping all per-form taps in one ceremony — available at the signed-PDF write |
| Idempotency lookup | `lib/idempotency.ts:17-22` | filters `key`+`endpoint`; `application_id` written (`:30-37`) but unread |
| `tryLoadPdf` | `source-pdfs.ts:34-40` | empty `catch { return null; }` |
| Finalize validator | `lib/pbv/finalizeValidation.ts` | PRD-62 adds Check 5 (hash). PRD-66 adds version-match (see Phase 1) |
| `signing_status` setter | `completeForm.ts:283-308` | `updateApplicationSigningStatus` writes `in_progress`/`complete` |

---

## Goals

1. A `generate-forms` run that would overwrite an unsigned PDF a signer is mid-ceremony on instead writes to a **new versioned path** and bumps `pbv_form_documents.generation_version`, so the bytes a prior signer already committed to (`document_hash`) are never silently rewritten.
2. `pbv_form_documents.generation_version` exists and is set on every generate-forms upsert; the unsigned-PDF storage path carries `-v${generationVersion}`.
3. Finalize blocks when a signature event was made against a different generation version than the form's current `generation_version` (the version-aware sibling of PRD-62's hash check), surfaced as a re-sign message.
4. The signed-PDF path carries `ceremony_id`; the write uses `upsert:false`; `signed_pdf_path` points at the latest while older signed artifacts remain in storage for audit.
5. `lib/idempotency.ts` scopes the cached-response lookup by `application_id` — cross-tenant replay is closed.
6. `tryLoadPdf` distinguishes "file absent" (`ENOENT` → `null`, intentional) from a real load error (logged as ERROR with context, still `null`).

## Non-goals

- **No** signing-flow refactor (PRD-62 owns unification + `unsigned_pdf_hash`). PRD-66 adds `generation_version` alongside it; it does not re-touch `completeFormSigning`'s structure beyond the signed-path suffix + the version-stamp on the signature event.
- **No** `X-Assisted-By` hardening (#4), atomic finalize event (#10), conditional/resolver fail-closed (#7/#14) — PRDs 63/64.
- No "discard signatures & regenerate" UI. PRD-66 makes regeneration **version-safe** server-side (a regenerate during signing produces a new version rather than corrupting the old); the deliberate-discard flow and any UI affordance are flagged for a later UI PRD, not built here.
- No change to `stampForm`, summary doc, intake, or documents beyond the version threading.

---

## Implementation phases

### Phase 1 — Version the unsigned PDF (audit #5, durable variant)

- **Migration** `supabase/migrations/<UTC-ts>_prd66_form_generation_version.sql` (mirror `20260521000000_prd55b_form_sourcing_corrections.sql` header style): `ALTER TABLE public.pbv_form_documents ADD COLUMN IF NOT EXISTS generation_version INTEGER NOT NULL DEFAULT 1;` + a `COMMENT ON COLUMN` noting it's the monotonically-increasing regeneration counter, bumped each time generate-forms re-stamps a form. **Write + commit only; do NOT apply to prod (`lieeeqqvshobnqofcdac`)** — list under "Prod migrations to apply" in `OPEN-DECISIONS.md`.
- **generate-forms** (`generate-forms/route.ts`): before stamping each `(form_id, language)`, read the current row's `generation_version` and `collected_signer_member_ids` (the upsert already reads `id`; extend the pre-stamp read or query first). Decide the version to write:
  - If no row exists, or the row exists with **no** collected signers → keep/initialise `generation_version` (write `1` on first create; on a clean regenerate with zero signatures, the version may stay the same and `upsert:true` is acceptable since no signer is committed to those bytes). [Inference]
  - If the row exists **and** has ≥1 collected signer (a ceremony is in flight or partially complete) → set `generation_version = existing + 1`. This is the regenerate-during-signing case.
  - Build the unsigned path with the version suffix: `pbv/${fullApp.id}/forms/${formId}-${language}-v${generationVersion}.pdf` (`generate-forms/route.ts:143`). Upload with `upsert:false` when the version was bumped (a brand-new path; clobber should fail loudly), `upsert:true` only for the same-version re-stamp case. [Inference]
  - Write `generation_version` and the versioned `unsigned_pdf_path` (and PRD-62's `unsigned_pdf_hash`) into the `pbv_form_documents` upsert (`:166-189`).
- **Signature events carry the version they signed.** `pbv_signature_events` already records `document_hash` (the bytes). The version is derivable: PRD-62's finalize Check 5 already compares `document_hash` to `pbv_form_documents.unsigned_pdf_hash`, which moves with the version. So **no new column on `pbv_signature_events` is required** — when generate-forms bumps the version it rewrites `unsigned_pdf_hash`, and Check 5 already flags any event whose hash no longer matches. PRD-66's version bump is what *causes* the hash to change on regenerate; Check 5 is the enforcement. Add a parallel, cheaper **Check 6** in `finalizeValidation.ts` only if a version column is desired for human-readable diagnostics — **default: rely on PRD-62 Check 5, do not add a redundant check; log the choice to OPEN-DECISIONS.** [Inference]
- The net effect: a mid-signing regenerate produces `…-v2.pdf` with a new `unsigned_pdf_hash`; the in-flight signer's event still references v1's hash; finalize Check 5 (PRD-62) blocks with "hash mismatch — please re-sign" instead of silently finalizing a packet whose stored bytes differ from what was signed.

### Phase 2 — Version the signed PDF path (audit #11)

- In `lib/pbv/signing/completeForm.ts` (post-PRD-62 the single signing-completion site): change the signed path at `:238` to `pbv/${appId}/forms/${formDoc.form_id}-${formDoc.language}-${ceremonyId}-signed.pdf` (`ceremonyId` is already an option field, `:24`). Change the upload at `:240-245` to `upsert: false`.
- `formDocUpdate.signed_pdf_path` (`:248`) keeps pointing at the just-written latest path. Older `…-${priorCeremony}-signed.pdf` objects remain in storage for audit lookup.
- If the `upsert:false` upload fails because the exact `(ceremony_id, form)` path already exists (a true idempotent replay of the same ceremony), treat it as a benign already-written case — re-point `signed_pdf_path` at it rather than throwing. [Inference] Distinguish this from a different-ceremony collision (which can't happen, since `ceremony_id` is unique per ceremony).
- **If PRD-62 has not yet landed** the route collapse when this PRD runs (it should have — 62 runs first), apply the identical change to the HOH route copy at `sign-form/route.ts:282-289` and note it `[Unverified]` in the build report. Default: PRD-62 done first → only `completeForm.ts` changes.

### Phase 3 — Scope idempotency by `application_id` (audit #9)

- In `lib/idempotency.ts`, add `.eq('application_id', applicationId)` to the existing-row query (`:17-22`), between the `.eq('endpoint', endpoint)` and `.maybeSingle()`. No migration. The upsert at `:30-37` already writes `application_id`, so cached rows are scoped correctly going forward; pre-existing rows without a matching `application_id` simply miss the cache and re-execute (idempotent handlers tolerate this). [Inference]

### Phase 4 — `tryLoadPdf` error inspection (audit #13)

- In `lib/pbv/form-generation/source-pdfs.ts:34-40`, replace the empty catch: inspect `err.code`. If `err.code === 'ENOENT'` (file not shipped — intentional for unsourced forms) return `null` silently. For any other error, `console.error('[source-pdfs] Failed to load <fileName>:', err)` (ERROR level, with the file name for context) and still `return null` so the module import / generate-forms request doesn't crash. [Inference] `loadPdf` throws a generic `Error` (not an `ENOENT`-coded fs error) when `existsSync` is false (`:28-29`) — treat that thrown message (`Source PDF not found`) as the intentional-absent case too, so a wrapper-thrown not-found is not logged as an operational error. Inspect both `err.code === 'ENOENT'` and the known not-found message.

---

## Verification / test plan

Static gates run in-session (the path-versioning, idempotency scope, and error-inspection are unit-testable without a deploy). Runtime gates need a preview + a live signing walk.

### Static (must pass before commit)
- **Gate 1 (unsigned versioning):** a `generate-forms` unit test where a `pbv_form_documents` row exists with ≥1 collected signer asserts the next run writes a path containing `-v2.pdf` and sets `generation_version = 2`; a run with zero collected signers does not bump.
- **Gate 2 (signed path versioned):** a `completeForm.ts` test asserts the signed-PDF upload path contains the `ceremony_id` and the upload is called with `upsert: false`.
- **Gate 3 (idempotency scope):** a `lib/idempotency.ts` test asserts the existing-row lookup includes `.eq('application_id', …)` (e.g. assert on the mock query chain) and that a same-key request for a *different* `application_id` does not return the cached response.
- **Gate 4 (tryLoadPdf):** a `source-pdfs.ts` test asserts an `ENOENT`-coded error returns `null` with no `console.error`; a non-`ENOENT` error returns `null` **and** logs at ERROR with the file name.
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; `vitest run` green.

### Deferred to the post-run verification pass (list in build report; do NOT block)
- **Gate R1:** on a deployed preview with the migration applied: start a multi-signer ceremony, sign one signer, move `intake_status` back to `in_progress`, re-run generate-forms — confirm the unsigned path is now `-v2`, `generation_version=2`, and finalize blocks with the PRD-62 hash-mismatch re-sign message.
- **Gate R2:** restart a ceremony for a fully-signed form and confirm the prior `…-${ceremony}-signed.pdf` still exists in storage alongside the new one; `signed_pdf_path` points at the new one.

---

## Open questions

- **O1:** Same-version re-stamp with `upsert:true` (Phase 1, zero-signer case) keeps a single object per version. Default taken: do not bump the version when there are no collected signers — a clean regenerate before anyone signs is safe to overwrite. Log to OPEN-DECISIONS; confirm post-run. [Inference]
- **O2:** Whether a human-readable `generation_version` column on `pbv_signature_events` is worth adding for diagnostics, vs relying solely on PRD-62's `unsigned_pdf_hash` Check 5 for enforcement. Default: rely on Check 5 (no `pbv_signature_events` schema change). Log to OPEN-DECISIONS. [Inference]
- **O3:** No "discard signatures & regenerate" UI is built here — version-safety is server-side only. Flag for a future UI PRD so a tenant who edits intake mid-signing gets an explicit choice rather than a silent version bump that later blocks finalize.

## Decisions

- **D1:** Durable version variant over the cheap 409 refuse (audit #5 option 1 vs 2): generate-forms versions the unsigned path + bumps `generation_version` rather than refusing with 409 `signing_in_progress`. A regenerate during signing is made safe, not blocked. The migration adds `generation_version`.
- **D2:** No new `pbv_signature_events` column — version enforcement rides PRD-62's `unsigned_pdf_hash` Check 5 (the hash changes when the version bumps). (Per O2.)
- **D3:** Signed-PDF path suffixed with `ceremony_id` + `upsert:false` (audit #11); `signed_pdf_path` tracks the latest, older artifacts retained.
- **D4:** Idempotency lookup scoped by `application_id` (audit #9); no migration.
- **D5:** `tryLoadPdf` logs non-`ENOENT` errors at ERROR and still returns `null` (audit #13); the intentional not-found path (incl. `loadPdf`'s thrown "Source PDF not found") stays silent.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `supabase/migrations/<ts>_prd66_form_generation_version.sql` | 1 | add `pbv_form_documents.generation_version INTEGER NOT NULL DEFAULT 1` — **commit only, list in OPEN-DECISIONS, do not apply** |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | 1 | read existing version + collected signers; bump on in-flight regenerate; versioned unsigned path; write `generation_version` to the upsert |
| `lib/pbv/signing/completeForm.ts` | 2 | signed path suffixed with `ceremony_id`; `upsert:false`; benign same-path replay handling |
| `lib/idempotency.ts` | 3 | add `.eq('application_id', applicationId)` to the existing-row lookup |
| `lib/pbv/form-generation/source-pdfs.ts` | 4 | `tryLoadPdf` inspects error: `ENOENT`/not-found → null silent; else log ERROR + null |
| `app/api/t/[token]/pbv-full-app/__tests__/generate-forms-versioning.test.ts` (new) | 1 | version bump on in-flight regenerate; no bump with zero signers |
| `lib/pbv/__tests__/completeForm.test.ts` | 2 | signed path carries `ceremony_id`; `upsert:false` (extend PRD-62's new test file) |
| `lib/__tests__/idempotency.test.ts` (new) | 3 | lookup scoped by `application_id`; cross-tenant key miss |
| `lib/pbv/form-generation/__tests__/source-pdfs.test.ts` (new) | 4 | ENOENT silent; other error logs ERROR |

If anything outside this list needs changing, take the safe default and log it to OPEN-DECISIONS rather than expanding scope.
