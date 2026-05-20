# Cursor/Windsurf Prompt — PRD-31: Hotfix Bundle for Audit Findings (PRDs 22–30)

## Context

The self-audit at `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md` found 17 issues in the PRDs 22–30 implementations. Four are runtime blockers; the end-to-end happy path does not work today. This pass fixes all 17.

Atomic commits per bug. Fix order per the audit's recommendation. No schema changes (one possible exception in L4 — defer if so).

## Required reading before you start

1. `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md` — the audit itself, every issue with file/line
2. `docs/fullApp-Plan/31-pbv-form-execution-hotfix_prd_2026-05-15.md` — this PRD with mapped fixes and acceptance criteria
3. `lib/pbv/intake-schema.ts` — canonical section slugs (drives C3, C4 fixes)
4. `scripts/field-maps/*.json` — to walk during L5 row_pattern audit
5. `lib/idempotency.ts` + `tenant_idempotency_keys` migration — server idempotency primitive (drives M2)
6. The 5 build reports for PRDs 24/26/27/28/29 — for context on the false-claim corrections (M2 + addendum)

## Closed decisions (do not relitigate)

- Atomic commit per bug
- Audit's fix order (Phase 1 → 8 per PRD-31)
- No schema changes — defer L4 if it requires one
- Idempotency: implement on intake/[section], sign-form, signature/capture (3 endpoints) — not the others
- M3: return 422 when fieldMap is null, not silent false-positive signed
- M4: handoffConfirmed lives in useSigningCeremony, not SignaturePadGate
- L5 row_pattern normalization: prefer plural `row_patterns` if any maps are mixed
- L1: KNOWN_PACKAGE_HASH set only after a real green E2E run
- Correction addendum goes alongside original build reports, not as a rewrite

## Decisions still open — pick during build, document in build report

- **L4 implementation strategy**: light-touch sentinel `form_document_id` for summary-signing audit rows VS schema-change-required nullable column. If schema-change needed: STOP that fix and surface — this PRD doesn't do schema. Default: try sentinel first.
- **H2 row coordinate mapping**: probable formula is `row_index = member.slot - 1`. Confirm against actual field maps (Citizenship Declaration row 1 = HOH). If wrong, document and adjust.
- **Whether to apply M2 to additional POSTs beyond the 3 listed**. If the audit's fix work turns up more that obviously need it (e.g., send-link), add them. Document.

## Build this pass (one commit per item)

### Phase 1 — Intake routing
1. **C3** fix `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` — replace `ALLOWED_SECTIONS` with canonical slugs from `lib/pbv/intake-schema.ts`. Add regression test `lib/__tests__/intake-section-slugs.test.ts`.
   Commit: `fix(pbv-intake): align intake/[section] ALLOWED_SECTIONS with PRD-25 slugs (C3)`
2. **C4** fix `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — replace `REQUIRED_SECTIONS` with `ALWAYS_SECTIONS` from intake-schema.
   Commit: `fix(pbv-intake): align intake/complete REQUIRED_SECTIONS with PRD-25 slugs (C4)`
3. **C1** fix `app/api/t/[token]/pbv-full-app/summary-pdf/route.ts:29` — change `'access_token'` to `'tenant_access_token'`.
   Commit: `fix(pbv-summary-pdf): query tenant_access_token, not access_token (C1)`

### Phase 2 — Magic-link insert
4. **C2** fix `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:87` — remove `full_application_id` key from the INSERT object. Verify the schema doesn't define it.
   Commit: `fix(pbv-signer): remove non-existent full_application_id from sign-form INSERT (C2)`

### Phase 3 — Bootstrap fields
5. **H4** fix `app/api/t/[token]/pbv-full-app/route.ts:32` — extend `.select()` with `intake_status, signing_status, submission_language`; add derived HOH member query and return `hoh_member_id`. Regression test `lib/__tests__/bootstrap-fields.test.ts`.
   Commit: `fix(pbv-bootstrap): return signing_status, intake_status, submission_language, hoh_member_id (H4)`

### Phase 4 — Signature stamping
6. **L5** walk all `scripts/field-maps/*.json`, dump key shapes to `scripts/output/audit/field-map-row-pattern-check.txt` (gitignored). Normalize any singular `row_pattern` to plural `row_patterns` array.
   Commit: `chore(pbv-field-maps): normalize row_pattern → row_patterns plural array (L5)`
7. **H1** fix `app/api/t/[token]/pbv-full-app/sign-form/route.ts:313-323` `buildSignatureFieldData` — also search `row_patterns[].columns` for `type === 'image'` fields whose name contains 'signature'. Regression test `lib/__tests__/signature-stamping-tables.test.ts`.
   Commit: `fix(pbv-sign-form): apply signature to table-style forms (H1)`
8. **H2** rewrite the final-stamp branch in `sign-form/route.ts:206-244`. When `allSigned`: query all `pbv_signature_events` for this form, download each signer's image from storage, compute each signer's row coordinate (default formula `row_index = member.slot - 1`), build a multi-signature field_data dict, stamp once. Regression test `lib/__tests__/signature-stamping-multisigner.test.ts`.
   Commit: `fix(pbv-sign-form): preserve all signers' signatures on multi-signer final stamp (H2)`

### Phase 5 — Magic-link signature storage
9. **H3** create `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` — same contract as the tenant capture endpoint, scoped to the member token. Upload data URL to `pbv-signatures` bucket, return storage path. Update `components/pbv/sign/MagicLinkSigningFlow.tsx` to call this first, then send the path. Update the member-scoped `sign-form/route.ts` to expect a real path. Regression test `lib/__tests__/magic-link-signature-storage.test.ts`.
   Commit: `fix(pbv-signer): store magic-link signature image in storage, not as data URL (H3)`

### Phase 6 — Route name + remaining mediums
10. **B1** in `tests/e2e/pbv-form-execution-happy-path.spec.ts`, change the `/submit` reference to `/finalize`.
    Commit: `test(pbv-e2e): correct submit→finalize endpoint name (B1)`
11. **M2** wire `withIdempotency` from `lib/idempotency.ts` into the 3 routes: `intake/[section]`, `sign-form`, `signature/capture`. Read `Idempotency-Key` header, dedupe via `tenant_idempotency_keys`.
    Commit: `fix(pbv-api): wire server-side Idempotency-Key dedup on intake/sign-form/capture (M2)`
12. **M3** in `sign-form/route.ts:211-234`, return 422 when `fieldMap` is null instead of silently flipping status to 'signed'. Don't update `formDocUpdate` either.
    Commit: `fix(pbv-sign-form): return 422 when fieldMap missing instead of false-positive signed (M3)`
13. **M4** lift `handoffConfirmed` from `SignaturePadGate` local state into `useSigningCeremony`. Key by ceremony_id. Suppress re-prompt within same ceremony.
    Commit: `fix(pbv-assisted): persist handoffConfirmed at ceremony scope (M4)`

### Phase 7 — Polish
14. **L2** in `components/pbv/intake/IntakeShell.tsx`, replace `canGoNext = !isReviewSection` with `canGoNext = !isReviewSection && isSectionComplete(sectionSlug, intakeData)`.
    Commit: `fix(pbv-intake): gate Next button on section completeness (L2)`
15. **L4** in `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`, also INSERT a `pbv_signature_events` row. Try sentinel `form_document_id` (e.g., NULL with a check constraint relaxation OR a dedicated 'summary' sentinel UUID). If schema change required: SKIP this fix, document in build report, defer to followup PRD.
    Commit: `fix(pbv-sign-summary): write audit row to pbv_signature_events (L4)` — only if achievable without schema change

### Phase 8 — Snapshot + addendum
16. **L1** run the full E2E (Playwright + Vitest). On first green, capture the produced hash from `package-hash.txt` and set `KNOWN_PACKAGE_HASH` in `pbv-form-execution-happy-path.spec.ts`.
    Commit: `test(pbv-e2e): record KNOWN_PACKAGE_HASH from first green run (L1)`
17. Write `docs/build-reports/22-30-audit-correction-addendum_2026-05-15.md` correcting: server-side idempotency false claim, PRD-27 test-count discrepancy, PRD-30 route-name claim, final tally of what got fixed in PRD-31.
    Commit: `docs(pbv-form-execution): audit correction addendum for PRDs 22-30 build reports`

### Phase 9 — Build report
Write `docs/build-reports/31-pbv-form-execution-hotfix-build-report_2026-05-15.md`. Per commit: what changed, regression test added, deviation from PRD-31 if any.

## Verification

After each commit:
- The specific bug's regression test passes
- `tsc --noEmit` clean
- Nothing else broke (run relevant test files)

After all commits:
- `npm run build` clean
- All new regression tests pass
- Full Playwright + Vitest E2E green
- `KNOWN_PACKAGE_HASH` set and stable across runs
- `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md` — every item marked addressed in the addendum

## Anti-patterns — do NOT

- Do NOT bundle multiple bugs into one commit — atomic per audit item
- Do NOT change schema (defer L4 if it'd need one)
- Do NOT remove the false claims from original build reports — add a correction addendum
- Do NOT silently update PRD-22-30 build reports
- Do NOT skip the regression tests
- Do NOT use `npm run build | Select-Object`
- Do NOT introduce new features
- Do NOT touch the source PDF or the source field maps semantically (only L5 key-name normalization)
- Do NOT push past the open L4 schema-change boundary — surface and defer

## Build report

`docs/build-reports/31-pbv-form-execution-hotfix-build-report_2026-05-15.md`:

1. **Per-bug status** — table mapping audit ID → commit hash → regression test → outcome
2. **L4 outcome** — was the sentinel approach viable, or deferred to followup?
3. **L5 audit output** — which maps had which keys; what was normalized
4. **M2 final scope** — which endpoints got idempotency
5. **E2E hash** — the locked-in `KNOWN_PACKAGE_HASH` value
6. **Test counts** — actual unit + integration counts (don't overstate)
7. **Confirmation:** `tsc --noEmit` + `npm run build` + E2E all green
8. **Remaining open items** — anything from the audit that punted to a followup
9. **Sign-off recommendation** — is the PBV form-execution build now end-to-end functional?

## When you're done

- 17 commits (or 16 if L4 deferred), build report, correction addendum
- Audit items all marked addressed in the addendum
- Clean `npm run build` + full green E2E
- Surface report path to Alex; if all green, the PBV form-execution build is production-eligible pending the HACH live conversation
