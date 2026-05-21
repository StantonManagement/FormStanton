# PRD-66 — PBV Regenerate-Lock & Launch Hardening — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening`
**Commit:** PRD-66: regenerate-lock + hardening

---

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20260521040000_prd66_form_generation_version.sql` | **NEW.** Adds `pbv_form_documents.generation_version INTEGER NOT NULL DEFAULT 1` + a `COMMENT ON COLUMN`. **NOT APPLIED** — listed in OPEN-DECISIONS. |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | (a) Before each stamp, reads the existing form-doc row's `generation_version` + `collected_signer_member_ids`. (b) Decides the version: no row → 1 (`upsert:true`); row with 0 signers → keep existing version (`upsert:true`); row with ≥1 signer → `existing + 1` (`upsert:false`). (c) Storage path is `…-${language}-v${generationVersion}.pdf` (replaces the old `…-unsigned.pdf`). (d) Writes `generation_version` to the `pbv_form_documents` upsert payload alongside PRD-62's `unsigned_pdf_hash`. |
| `lib/pbv/signing/completeForm.ts` | Signed-PDF path is now `pbv/${appId}/forms/${form_id}-${language}-${ceremonyId}-signed.pdf` (was unversioned `…-signed.pdf`). Upload uses `upsert:false`. A benign same-ceremony replay (Supabase Storage 409 / "exists" / "duplicate") is caught and treated as already-written rather than throwing. |
| `lib/idempotency.ts` | The existing-row lookup chain gains `.eq('application_id', applicationId)` between `endpoint` and `maybeSingle`. Pre-existing cache rows without a matching `application_id` simply miss the cache and the (idempotent) handler re-runs. |
| `lib/pbv/form-generation/source-pdfs.ts` | `tryLoadPdf` now inspects `err.code` + `err.message`. `ENOENT` or the wrapper's "Source PDF not found" message → return null silently (intentional unsourced-form path). Any other error → `console.error('[source-pdfs] Failed to load ${fileName}:', err)` and still return null. |
| `lib/pbv/__tests__/generate-forms-versioning.test.ts` | **NEW.** 7 structural cases — the version-decision branches are present in the route source (reads existing version + collected signers, keeps/bumps/initializes correctly, writes `-v${generationVersion}.pdf`, toggles `upsertOnUpload`, writes the column on upsert). |
| `lib/pbv/__tests__/completeForm.test.ts` | Extended with 1 case asserting the signed-PDF upload uses the `…${ceremonyId}-signed.pdf` literal and `upsert:false`, plus references the benign-replay handling. (The all-signed code path itself is unit-tested structurally because the runtime branch needs heavy storage/sigImageMap/stamper mocking — see test comment.) |
| `lib/__tests__/idempotency-scoped.test.ts` | **NEW.** Structural assertion: the `tenant_idempotency_keys` lookup block includes `.eq('application_id', applicationId)` before `.maybeSingle()`, and the upsert still writes `application_id`. |
| `lib/__tests__/idempotency.test.ts` | Mock chain extended with a third `.eq` so the existing 4 functional cases still exercise the now-three-eq lookup. |
| `lib/pbv/form-generation/__tests__/source-pdfs-tryload.test.ts` | **NEW.** 3 cases via `vi.doMock('fs', …)` — `ENOENT` from `readFileSync` returns null silently; the wrapper's "Source PDF not found" path stays silent; a `EACCES` error returns null AND logs `[source-pdfs] Failed to load <file>:` at ERROR. |

PRD-62 had already landed the HOH-route collapse (`sign-form/route.ts` now delegates to `completeFormSigning`), so the signed-path change lives in one place (`completeForm.ts`). No `[Unverified]` fallback needed.

## Static gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1 — unsigned versioning | ✅ PASS | `generate-forms-versioning.test.ts` (7/7). The four decision branches (no row → 1, 0 signers → keep, ≥1 signer → +1, `-v${gen}.pdf` path) are all asserted on the route source. |
| Gate 2 — signed path versioned | ✅ PASS | `completeForm.test.ts` case asserts the literal `${ceremonyId}-signed.pdf` template + `upsert:false` on the upload call. |
| Gate 3 — idempotency scope | ✅ PASS | `idempotency-scoped.test.ts` (structural) + the updated `idempotency.test.ts` (4/4 functional cases still green with the 3-eq chain). |
| Gate 4 — `tryLoadPdf` error inspection | ✅ PASS | `source-pdfs-tryload.test.ts` (3/3): ENOENT silent, "Source PDF not found" silent, EACCES logs ERROR with the file name. |
| Gate 5 — `tsc --noEmit` + `npm run build` + cross-PRD vitest | ✅ PASS | tsc silent; build exit 0; PRD-62/63/64/65 tests all still green (47/47 across the six cross-PRD spec files). |

## Decisions logged (see OPEN-DECISIONS.md)

- D1/O1 — unsigned PDF versioning (durable variant; zero-signer no-bump rule).
- D2/O2 — no `generation_version` column on `pbv_signature_events` (PRD-62 Check 5 enforces).
- D3 — signed-PDF path includes `ceremony_id`; `upsert:false`; benign same-ceremony replay tolerated.
- D4 — idempotency scoped by `application_id`.
- D5 — `tryLoadPdf` logs non-ENOENT errors.
- O3 — no "discard & regenerate" UI built; flagged for a future UI PRD.

## Prod migrations to apply

- `supabase/migrations/20260521040000_prd66_form_generation_version.sql`. Apply **before** deploying the code change (the route now writes `generation_version` on every upsert). The `DEFAULT 1` fills existing rows safely.

## Deferred runtime gates (post-run verification pass)

- **R1 — versioned regenerate end-to-end.** Apply the migration; start a multi-signer ceremony; sign one signer; move `intake_status` back to `in_progress`; re-run `generate-forms`. Expect: unsigned path becomes `-v2.pdf`, `generation_version` becomes 2, finalize blocks with PRD-62's "hash mismatch — please re-sign" message. Re-sign all signers → finalize succeeds.
- **R2 — signed-path retention.** Restart a ceremony for a fully-signed form (e.g. by clearing `collected_signer_member_ids`, then re-signing under a fresh `ceremony_id`). Expect: the prior `…-${oldCeremony}-signed.pdf` is still in storage alongside the new `…-${newCeremony}-signed.pdf`; `pbv_form_documents.signed_pdf_path` points at the new one.

## Out-of-lane (untouched)

- `completeFormSigning` structure and `unsigned_pdf_hash` — PRD-62 territory.
- `X-Assisted-By` and atomic finalize event — PRD-64.
- Conditional/resolver fail-closed — PRD-63.
- `stampForm`, summary doc, intake, documents UI. No "discard & regenerate" UI built; flagged as O3.

## Next

Proceed to PRD-67 prompt (`docs/fullApp-Plan/prompts/67-pbv-tenant-review-edit-and-document-management_prompt_2026-05-21.md`).
