# PRD-31 — PBV Form Execution: Hotfix Bundle (Audit Findings 22–30)

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md`
**Depends on:** PRDs 22–30 implementations landed

---

## Problem Statement

The self-audit at `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md` surfaced 17 issues across PRDs 22–30 implementations. Four are critical runtime blockers that prevent the end-to-end happy path from working at all. Four more produce wrong-but-quiet behavior (unsigned PDFs reaching HACH, dashboards reading stale defaults). The remainder are polish, false claims in build reports, and an unset snapshot hash.

This PRD bundles all 17 fixes into one focused pass. Each issue maps to a specific file/line and has a documented remedy in the audit. Atomic commits per bug, fix order per the audit's recommendation.

## Evidence baseline (verified 2026-05-15)

- Audit ran `tsc --noEmit` and fixed one stray TS error in `LobbyIntakePanel.tsx`.
- Audit confirmed PRDs 22, 23, 24, 28, 29 implementations are clean.
- Audit found critical defects in PRD-25 (intake API slugs), PRD-26 (bootstrap fields + summary-pdf typo), PRD-27 (magic-link signature handling).
- Audit found false claims in build reports: server-side idempotency not actually implemented; PRD-30 test calls `/submit` instead of `/finalize`.

## Issues addressed (mapped from audit)

### Critical (4)
- **C1** — `app/api/t/[token]/pbv-full-app/summary-pdf/route.ts:29` uses `.eq('access_token', token)`; column is `tenant_access_token`. Every call 404s.
- **C2** — `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:87` inserts non-existent `full_application_id` column into `pbv_signature_events`. Every magic-link signature throws.
- **C3** — `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts:18-30` ALLOWED_SECTIONS uses legacy slugs. 6 of 11 PRD-25 sections rejected.
- **C4** — `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:15` REQUIRED_SECTIONS uses legacy slug `applicant`. Intake completion blocked.

### High (4)
- **H1** — `app/api/t/[token]/pbv-full-app/sign-form/route.ts:313-323` `buildSignatureFieldData` only searches flat `fieldMap.fields`. Signatures silently omitted for ~8 table-style forms.
- **H2** — `app/api/t/[token]/pbv-full-app/sign-form/route.ts:206-244` final stamp only applies the current signer's image. Earlier signers' signatures lost on multi-signer forms.
- **H3** — `components/pbv/sign/MagicLinkSigningFlow.tsx:93-104` sends raw data URL as `signature_image_path`. Final stamp pipeline can't `.download()` a data URL.
- **H4** — `app/api/t/[token]/pbv-full-app/route.ts:32` bootstrap GET missing `signing_status`, `intake_status`, `submission_language`, `hoh_member_id`. Dashboard + dispatcher read stale defaults.

### Medium (3 actionable; M1 re-evaluated as not-a-bug)
- **M2** — Build reports claim server-side idempotency but `withIdempotency` is not used in any PBV route. Either remove the claim or implement.
- **M3** — `sign-form/route.ts:211-234` sets `status = 'signed'` even when `fieldMap` was null (form marked complete with no signed PDF).
- **M4** — `AssistedHandoffPrompt` `handoffConfirmed` is local state; resets on every form sign in same assisted ceremony.

### Low (4 actionable; L3 was a self-correction in the audit)
- **L1** — `tests/e2e/pbv-form-execution-happy-path.spec.ts:35` `KNOWN_PACKAGE_HASH = 'UPDATE_ME'`. Snapshot contract fails until updated post first successful run.
- **L2** — `components/pbv/intake/IntakeShell.tsx` `canGoNext` is `!isReviewSection` unconditionally. Required fields not validated before Next.
- **L4** — `sign-summary/route.ts` doesn't create a `pbv_signature_events` row. Summary signing has no audit-trail row in the events table.
- **L5** — Field maps may have inconsistent `row_pattern` (singular) vs `row_patterns` (plural array) keys. Audit needed.

### Bonus item (audit Cross-PRD Consistency Check)
- **B1** — PRD-30 test `pbv-form-execution-happy-path.spec.ts` calls `POST /submit`; actual route is `POST /finalize`. Either rename test target or alias the route.

## Key decisions

### 1. Each bug gets its own atomic commit

Fix → test (or test update) → commit. Easy to revert any single fix; bisectable. Single commit per audit item.

### 2. Fix order per audit recommendation

1. **C1, C3, C4** — intake routing (without these the flow is dead-on-arrival)
2. **C2** — magic-link insert
3. **H4** — bootstrap fields (dashboard + dispatcher correctness)
4. **H1, H2** — signature stamping correctness
5. **H3** — magic-link signature image storage
6. **B1** — `/submit` vs `/finalize` test path
7. **M2** — idempotency: pick implement-or-correct (see §3 below)
8. **M3** — defensive `status = 'signed'` gate
9. **M4** — handoff confirmed at ceremony scope
10. **L4** — summary signing audit row
11. **L2** — Next button gating
12. **L5** — row_pattern key audit
13. **L1** — record snapshot hash after first green E2E run

### 3. Idempotency decision (M2)

Two acceptable paths:
- **(a) Implement** — wire `withIdempotency` into the 3 most consequential POSTs (`intake/[section]`, `sign-form`, `signature/capture`). Uses existing `lib/idempotency.ts` + `tenant_idempotency_keys`. Real protection against retries.
- **(b) Correct the claim** — remove JSDoc and build-report claims that say "idempotent". Document that retries may double-write.

**Default: (a) for the 3 endpoints listed**. They handle real money-equivalent state (signed PDFs) where a double-write could leave audit confusion. Other POSTs (resume, send-link) are fine without; they're rate-limited at the model layer.

### 4. Build-report corrections

After the fixes land, write a single addendum file `docs/build-reports/22-30-audit-correction-addendum_2026-05-15.md` correcting the false claims (idempotency, test counts, route names). Don't rewrite the original build reports — leave them as a record of what was claimed and add the correction notice alongside.

### 5. L5 row_pattern audit goes first as a check, before H1/H2 fixes

Before writing the H1/H2 fix, run a script that walks all `.json` field maps and confirms which key (`row_pattern` vs `row_patterns`) is used. If inconsistent, normalize to one (probably `row_patterns` plural array, since the stamper already supports both — pick the more general form). Save the audit output to `scripts/output/audit/field-map-row-pattern-check.txt`.

### 6. No schema changes

The audit didn't surface any missing columns. C2 is a code-side typo, not a missing column. Don't add migrations.

## Scope

### What this PRD does

- All 17 audit-actionable fixes
- Build-report correction addendum
- Field-map row_pattern consistency audit
- Tests where existing tests pass over the fixed paths
- New tests for the bugs that existing tests missed (each H-level fix gets a regression test)

### What this PRD does NOT do

- Does not change any DB schema
- Does not write new features
- Does not handle source-pending forms (still feature-flagged off)
- Does not implement Twilio (still stubbed)
- Does not rewrite the original build reports

## Affected files

### Critical fixes
- `app/api/t/[token]/pbv-full-app/summary-pdf/route.ts` (C1)
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` (C2)
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` (C3)
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` (C4)

### High fixes
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts` (H1, H2)
- `components/pbv/sign/MagicLinkSigningFlow.tsx` (H3)
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` (H3 — server side of fix)
- `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` (NEW — member-scoped capture endpoint)
- `app/api/t/[token]/pbv-full-app/route.ts` (H4 — bootstrap)

### Medium fixes
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` (M2 — idempotency wiring)
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts` (M2 — idempotency wiring + M3 — fieldMap null guard)
- `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` (M2 — idempotency wiring)
- `lib/pbv/hooks/useSigningCeremony.ts` OR `components/pbv/AssistedHandoffPrompt.tsx` (M4 — ceremony-scoped handoffConfirmed)

### Low fixes
- `tests/e2e/pbv-form-execution-happy-path.spec.ts` (L1 — hash + B1 route name)
- `components/pbv/intake/IntakeShell.tsx` (L2)
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` (L4)
- `scripts/field-maps/*.json` (L5 — audit, possibly normalize)

### New tests
- `lib/__tests__/intake-section-slugs.test.ts` — regression for C3/C4
- `lib/__tests__/signature-stamping-tables.test.ts` — regression for H1
- `lib/__tests__/signature-stamping-multisigner.test.ts` — regression for H2
- `lib/__tests__/magic-link-signature-storage.test.ts` — regression for H3
- `lib/__tests__/bootstrap-fields.test.ts` — regression for H4

### New build-report addendum
- `docs/build-reports/22-30-audit-correction-addendum_2026-05-15.md`

### New audit artifact
- `scripts/output/audit/field-map-row-pattern-check.txt` (gitignored)

## Phases

### Phase 1 — Intake routing (C1, C3, C4)
1. Fix C3: replace `ALLOWED_SECTIONS` in `intake/[section]/route.ts` with the canonical slugs from `lib/pbv/intake-schema.ts`.
2. Fix C4: replace `REQUIRED_SECTIONS` in `intake/complete/route.ts` likewise.
3. Fix C1: change `summary-pdf/route.ts` line 29 from `access_token` to `tenant_access_token`.
4. Add regression test `intake-section-slugs.test.ts`.
5. Commits (3 separate):
   - `fix(pbv-intake): align intake/[section] ALLOWED_SECTIONS with PRD-25 slugs (C3)`
   - `fix(pbv-intake): align intake/complete REQUIRED_SECTIONS with PRD-25 slugs (C4)`
   - `fix(pbv-summary-pdf): query tenant_access_token, not access_token (C1)`

### Phase 2 — Magic-link insert (C2)
1. Remove `full_application_id` from the INSERT in `signer/[member_token]/sign-form/route.ts:87`.
2. Verify against schema migration `20260515020000`.
3. Commit: `fix(pbv-signer): remove non-existent full_application_id from sign-form INSERT (C2)`.

### Phase 3 — Bootstrap fields (H4)
1. Extend `.select()` in `app/api/t/[token]/pbv-full-app/route.ts:32` to include `intake_status, signing_status, submission_language`.
2. Add derived `hoh_member_id` query (slot=1 member; cache on response).
3. Update consuming hooks (`useDashboardState`, dispatcher) only if they were reading a default — they should already read these correctly if the API returns them.
4. Add `bootstrap-fields.test.ts`.
5. Commit: `fix(pbv-bootstrap): return signing_status, intake_status, submission_language, hoh_member_id (H4)`.

### Phase 4 — Signature stamping correctness (L5 audit → H1 → H2)
1. **L5 first**: walk all `scripts/field-maps/*.json`, dump every form's row-table key shape to `scripts/output/audit/field-map-row-pattern-check.txt`. If any forms use both keys, normalize to plural `row_patterns` array.
2. **H1**: extend `buildSignatureFieldData` in `sign-form/route.ts:313-323` to also search `row_pattern.columns` and `row_patterns[].columns` for image fields whose name includes 'signature'. Add `signature-stamping-tables.test.ts`.
3. **H2**: rewrite the final-stamp branch in `sign-form/route.ts:206-244`. When `allSigned`, query all `pbv_signature_events` rows for the form, download each signer's signature image, build a multi-signature field_data covering each signer's row coordinate, then stamp once. Add `signature-stamping-multisigner.test.ts`.
4. Commits (3):
   - `chore(pbv-field-maps): normalize row_pattern → row_patterns plural array (L5)`
   - `fix(pbv-sign-form): apply signature to table-style forms (H1)`
   - `fix(pbv-sign-form): preserve all signers' signatures on multi-signer final stamp (H2)`

### Phase 5 — Magic-link signature storage (H3)
1. Create `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts`. Same contract as the tenant-scoped capture endpoint but scoped to the member token. Uploads data URL to `pbv-signatures` bucket, returns the path.
2. Modify `components/pbv/sign/MagicLinkSigningFlow.tsx:93-104` to call the new capture endpoint first, then send the returned path in the `sign-form` call.
3. Modify the member-scoped `sign-form/route.ts` to expect a real path (not a data URL).
4. Add `magic-link-signature-storage.test.ts`.
5. Commit: `fix(pbv-signer): store magic-link signature image in storage, not as data URL (H3)`.

### Phase 6 — Test/route name + remaining mediums (B1, M2, M3, M4)
1. **B1**: in `pbv-form-execution-happy-path.spec.ts`, change `/submit` → `/finalize`.
2. **M2**: wire `withIdempotency` from `lib/idempotency.ts` into `intake/[section]`, `signature/capture`, `sign-form`. Read `Idempotency-Key` header; dedupe via `tenant_idempotency_keys` table.
3. **M3**: in `sign-form/route.ts:211-234`, move `formDocUpdate.status = 'signed'` inside the `if (fieldMap)` block, OR return 422 when `!fieldMap`. Pick the latter — silent acceptance hides a deployment bug.
4. **M4**: lift `handoffConfirmed` out of `SignaturePadGate` local state into `useSigningCeremony` ceremony-level state. Once acknowledged for a ceremony_id, don't re-prompt within that ceremony.
5. Commits (4):
   - `test(pbv-e2e): correct submit→finalize endpoint name (B1)`
   - `fix(pbv-api): wire server-side Idempotency-Key dedup on intake/sign-form/capture (M2)`
   - `fix(pbv-sign-form): return 422 when fieldMap missing instead of false-positive signed (M3)`
   - `fix(pbv-assisted): persist handoffConfirmed at ceremony scope (M4)`

### Phase 7 — Polish (L2, L4)
1. **L2**: wire `isSectionComplete(sectionSlug, intakeData)` from `lib/pbv/intake-schema.ts` into `IntakeShell.canGoNext`.
2. **L4**: in `sign-summary/route.ts`, also INSERT a `pbv_signature_events` row referencing the summary (use a sentinel `form_document_id`, OR add a `summary_id` column — pick the lowest-touch option, document choice). Default: the audit suggests "create a synthetic `pbv_form_documents` row for the summary" — that's heavy. Lighter option: relax the `form_document_id` NOT NULL constraint in a tiny migration. **Decision needed during build.** If it requires a schema change, defer to a separate followup PRD — this PRD is "no schema changes".
3. Commits (2):
   - `fix(pbv-intake): gate Next button on section completeness (L2)`
   - `fix(pbv-sign-summary): write audit row to pbv_signature_events (L4)` (only if doable without schema change)

### Phase 8 — Snapshot hash + addendum (L1)
1. Run the E2E suite. Once Playwright + Vitest pass green, copy the produced hash into `KNOWN_PACKAGE_HASH`.
2. Write `docs/build-reports/22-30-audit-correction-addendum_2026-05-15.md` with: idempotency-claim correction, test-count correction, route-name correction, and final tally.
3. Commits (2):
   - `test(pbv-e2e): record KNOWN_PACKAGE_HASH from first green run (L1)`
   - `docs(pbv-form-execution): audit correction addendum for PRDs 22-30 build reports`

### Phase 9 — Build report
Write `docs/build-reports/31-pbv-form-execution-hotfix-build-report_2026-05-15.md`. Cover each commit, regression test added, and confirm `tsc --noEmit` + full E2E pass.

## Out of scope

- Schema changes (defer L4-schema-variant if it needs one)
- New features
- Source-pending forms
- Twilio integration
- Re-running PRDs 22-30 from scratch

## Acceptance criteria

- All 4 Critical bugs fixed; intake → forms → signing flow runs end-to-end
- All 4 High bugs fixed; HACH-bound PDFs contain correct signatures from all required signers
- Idempotency either implemented (default) or false claim removed from JSDoc/build reports (M2)
- `KNOWN_PACKAGE_HASH` set from a real green E2E run
- `tsc --noEmit` passes
- All new regression tests pass
- `npm run build` clean
- Audit correction addendum committed
- Full E2E (Playwright + Vitest) passes in CI

## Open questions (resolve during build)

- **L4 implementation:** light-touch sentinel `form_document_id` vs schema-change-required nullable column. Document choice + rationale in build report; if schema change needed, this PRD defers it.
- **M2 scope:** the PRD wires idempotency into 3 endpoints. If the audit's reach turned up additional ones during fix work, add them — document in build report.
- **H2 row coordinate resolution:** the existing field maps record per-signer signature positions via row_pattern. The fix code needs a deterministic mapping from `signer_member_id` → row index → row y-coordinate. The simplest mapping is `slot - 1` (member with slot=1 is row 0). Confirm against actual field map structure during build.
