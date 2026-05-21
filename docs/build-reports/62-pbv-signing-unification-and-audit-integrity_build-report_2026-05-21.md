# PRD-62 — PBV Signing Unification & Audit-Trail Integrity — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening` (off `feat/pbv-full-finalization` — see OPEN-DECISIONS branch-base entry)
**Commit:** PRD-62: signing unification + audit-trail integrity (SHA recorded after commit)

---

## What changed

| File | Change |
|---|---|
| `lib/pbv/signing/completeForm.ts` | `CompleteFormOptions`: added `typedName`, `ipAddress`, `userAgent`; removed `request: Request`. Insert now writes `typed_name: options.typedName` (was `member.name` with a "Will be updated by caller" comment that no caller honored). |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | **Replaced the inline ~270-line signing reimplementation** with a single `completeFormSigning({...})` call. Kept the HOH-only summary-doc-signed gate, the `X-Assisted-By` resolver, the `withTenantContext` wrapper, and the custom `sign-form:${ceremony_id}:${form_document_id}` idempotency key. Deleted `loadFieldMapForSigning`, `buildSignatureFieldDataF5`, and the `@deprecated buildSignatureFieldData` dead helper, plus their `stampForm` / `FieldMap` / `createHash` imports. |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | Deleted the `mockRequest` cast-to-`Request`. Now passes `typedName`, `ipAddress`, `userAgent` directly to `completeFormSigning`. |
| `lib/pbv/finalizeValidation.ts` | Check 3 select gains `unsigned_pdf_hash`. **New Check 5**: for each non-skipped form with a non-null `unsigned_pdf_hash`, queries `pbv_signature_events.document_hash` and emits a `missing.signatures` entry whenever a recorded hash mismatches the cached one (label includes "signature/document hash mismatch — please re-sign"). Null cached hash = skip (legacy rows). |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | At the unsigned-PDF upload, computes `sha256Hex(stampedPdf)` and writes it to the `pbv_form_documents` upsert as `unsigned_pdf_hash`. |
| `supabase/migrations/20260521010000_prd62_unsigned_pdf_hash.sql` | **NEW.** Adds the column + a `COMMENT ON COLUMN`. **NOT APPLIED** — listed in OPEN-DECISIONS. |
| `lib/pbv/__tests__/completeForm.test.ts` | **NEW.** Per-table queued Supabase mock; asserts (Gate 2) the inserted `typed_name` is `options.typedName`, not `member.name`; (Gate 3) `signing_device` is updated on the first signer's tap when `allSigned === false`. |
| `lib/pbv/__tests__/finalizeValidation.test.ts` | Extended with three Check-5 cases: hash-mismatch blocks finalize; matching hash stays ready; null cached hash skips the check (no extra event query). |
| `lib/pbv/__tests__/sign-form-unification.test.ts` | **NEW.** Reads the HOH route source and asserts (Gate 1) it imports `completeFormSigning`, calls it with `typedName`/`ipAddress`/`userAgent`, no longer defines `buildSignatureFieldDataF5` / `loadFieldMapForSigning` / `@deprecated` helper, no longer imports `stampForm`, and still preserves the summary-doc gate. (Lives under `lib/pbv/__tests__/` because `vitest.config` only includes `lib/**` and `components/**`.) |

Line-ref drift in Step 0: none — the line refs in the PRD held against the on-disk code.

## Static gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1 — HOH route delegates; route-local helpers gone | ✅ PASS | `sign-form-unification.test.ts` covers it. Grep also confirms `buildSignatureFieldDataF5`, the `@deprecated` copy, and `loadFieldMapForSigning` are gone from the route. |
| Gate 2 — inserted `typed_name === options.typedName` | ✅ PASS | `completeForm.test.ts` (Gate 2). Test sets DB-name and typed-name to different values; insert payload carries the typed value. |
| Gate 3 — per-signer `signing_device` on first tap (allSigned=false) | ✅ PASS | `completeForm.test.ts` (Gate 3). Multi-signer form (`['m1','m2']`), only `m1` signs, member-update fires with `signing_device: 'hoh_device'` for `m1`. |
| Gate 4 — finalize blocks on hash mismatch; passes on match | ✅ PASS | `finalizeValidation.test.ts` (PRD-62 block, three cases). |
| Gate 5 — `tsc --noEmit` + `npm run build` + `vitest run` (PRD-62 specs) | ✅ PASS | tsc: silent. build: exit 0. PRD-62 vitest: 16/16 green across 3 test files. |

`npx vitest run` (full suite) shows ~10 unrelated test files failing on this branch. Confirmed pre-existing by stashing the PRD-62 changes and re-running — same failures. Cataloged in OPEN-DECISIONS "Pre-existing test-suite baseline failures" entry. PRD-62 introduces no new failures.

## Decisions logged (see OPEN-DECISIONS.md)

- `[PRD-62] Branch base` — `feat/pbv-launch-hardening` off `feat/pbv-full-finalization` (finalization batch not yet merged).
- `[PRD-62] Legacy null-unsigned_pdf_hash rows skip Check 5` (O1 default) — no retroactive block; backfill is optional.
- `[PRD-62] HOH summary-doc-signed gate stays in the HOH route` (D3 confirmation).
- `[PRD-62] Pre-existing test-suite baseline failures` — informational; out of lane for this PRD.

## Prod migrations to apply (listed in OPEN-DECISIONS)

- `supabase/migrations/20260521010000_prd62_unsigned_pdf_hash.sql` — adds `pbv_form_documents.unsigned_pdf_hash`. Additive, nullable, safe to deploy code before applying the migration (existing rows simply skip Check 5 until they're regenerated).

## Deferred runtime gates (post-run verification pass)

- **R1 — multi-signer device attribution.** On a deployed preview, sign `hud_9886a` via the HOH path with two adults. Confirm `pbv_household_members.signing_device` is recorded for each signer (not overwritten with only the last signer's value, which was the pre-PRD bug at HOH `sign-form/route.ts:296-299`).
- **R2 — member-token `typed_name` integrity.** On a deployed preview, sign a form via a member's magic link, typing a name different from the intake DB name. Confirm `pbv_signature_events.typed_name` equals the typed value.
- **R3 — finalize hash-mismatch block.** After applying the migration and generating fresh forms, finalize should succeed. Then mutate a stored unsigned PDF (or its `pbv_form_documents.unsigned_pdf_hash`) and confirm finalize blocks with the "hash mismatch — please re-sign" message; restoring the bytes/hash unblocks.

## Out-of-lane audit findings (NOT touched, by design)

- #4 `X-Assisted-By` session/HMAC hardening
- #5 regenerate-lock
- #7 / #14 fail-closed conditional/resolver defaults
- #9 idempotency scoping
- #10 atomic finalize event
- #11 signed-PDF versioning
- #13 `tryLoadPdf` error inspection

These are scoped to PRDs 63–67 in this same launch-hardening batch.

## Next

Proceed to PRD-63 prompt (`docs/fullApp-Plan/prompts/63-pbv-failclosed-generation-defaults_prompt_2026-05-21.md`).
