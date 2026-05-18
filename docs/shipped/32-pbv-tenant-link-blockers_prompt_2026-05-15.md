# Cursor/Windsurf Prompt — PRD-32: PBV Tenant Link Ship-Blockers

## Context

PRD-31 closed 14 of 17 audit findings. Two follow-on reviews (`docs/audit/tenant-link-form-fill-audit_2026-05-15.md` and a separate repo scan in the project conversation) found **six more critical/high defects** that block a real EN tenant from completing the full-app flow. The E2E test misses all six because `tests/e2e/helpers/createMariaApplication.ts` pre-populates `pbv_household_members` directly — the new intake flow never does, and that's defect F2 below.

Without this PRD, the EN tenant link is non-functional end-to-end. Cannot be handed to a real applicant.

Atomic commits per defect. Regression tests required. No schema changes.

## Required reading before you start

1. `docs/fullApp-Plan/32-pbv-tenant-link-blockers_prd_2026-05-15.md` — this PRD, full feature spec + open decisions
2. `docs/audit/tenant-link-form-fill-audit_2026-05-15.md` — Cascade's audit covering D1-D11
3. `lib/pbv/intake-schema.ts` — canonical section slugs and `ALWAYS_SECTIONS` (drives F1)
4. `app/api/t/[token]/pbv-full-app/route.ts:294-587` — legacy POST. Source for the F2 member + document seeding port
5. `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — current implementation (F1 + F2 target)
6. `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:101-187` — the loop F4 refactors
7. `app/api/t/[token]/pbv-full-app/sign-form/route.ts:200-249` — the `allSigned` branch F5 rewrites
8. `components/pbv/intake/SectionReview.tsx:200-218` — the routing line F3 changes
9. `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts:55-69` — F6 target
10. `lib/ssnEncryption.ts`, `lib/memberFilter.ts` — reused by F2
11. `tests/e2e/helpers/createMariaApplication.ts` + `tests/e2e/pbv-form-execution-happy-path.spec.ts` — E2E coverage gap

## Closed decisions (do not relitigate)

- Atomic commit per defect (F1–F6)
- No schema changes
- D5 SMS sending out of scope for this PRD
- D6 stale conditional data out of scope
- D7 deep-link section gating out of scope
- D8 summary audit row stays deferred (needs schema change)
- D9 PT translation review out of scope
- F2 re-sync semantics: delete-then-insert members on every `/intake/complete` call (supports edit-and-resubmit)
- F2 commit point: `/intake/complete` writes members + seeds documents; legacy POST untouched
- F4 approach: hoist required-ids to union, single row per (form_id, language); do **not** alter unique constraint
- F5 marker scheme: emit per-row markers keyed by `signer_member_id`; `imageResolver` maps to per-signer bytes
- F6: add `_resume_section` and `_last_saved_at` writes — both fields already in the schema

## Decisions still open — pick during build, document in build report

- **F2 SSN handling**: `intake_data.household.members[].ssn` may be `ssn_last_four` only or `ssn` (full). Confirm against `IntakeMember` (`lib/pbv/intake-schema.ts:51-61`) and the actual UI. If only last-four available, store `ssn_last_four` and leave `ssn_encrypted` null. Document.
- **F2 income data join**: `pbv_household_members` has per-source boolean flags (`has_ssi`, `has_ss`, etc.) AND `annual_income`. Source from `intake_data.income.by_member[slot].income_sources` array → derive booleans (same pattern as `route.ts:381-390`). If income section is missing for a slot, default to zero/false. Document.
- **F2 criminal_history join**: `pbv_household_members.criminal_history` is nullable boolean. Source from `intake_data.criminal_history.by_member[slot].has_criminal_history`. If section absent, leave null. Document.
- **F2 phone source**: `pbv_full_applications.phone` is updated. `intake_data.contact` has `phone_cell`, `phone_home`, `phone_work`. Pick `phone_cell ?? phone_home ?? phone_work`. Document choice.
- **F5 row coordinate formula**: default is `row_index = member.slot - 1`. **Verify against `scripts/field-maps/citizenship-declaration-en.json`** during build — HOH is row 0. If field maps use a different convention, adjust and document the actual mapping per form.
- **F2 ssn_consent_text_version / sms_consent fields**: legacy POST writes `sms_consent_captured_at` + `sms_consent_text_version` when phone is set. Mirror this in F2.

## Build this pass (one commit per item)

### Phase 1 — Intake completion bridge

1. **F1** — `lib/pbv/intake-schema.ts`: remove `'review'` from `ALWAYS_SECTIONS`. `isSectionComplete('review', ...)` already returns `false` — leave that as-is. Add regression test `lib/__tests__/intake-complete-no-review.test.ts` that POSTs `/intake/complete` with all real sections filled and no `review` key, asserts 200.
   Commit: `fix(pbv-intake): remove 'review' from ALWAYS_SECTIONS so /intake/complete stops 422-ing (F1)`

2. **F2** — `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`: after the validation pass and before stamping `intake_status='complete'`, port the member + document seeding logic from the legacy POST.
   - Read `intake_data.household.members[]`, `intake_data.income.by_member[]`, `intake_data.criminal_history.by_member[]`, `intake_data.contact`, `intake_data.dv_homeless_ra`, `intake_data.childcare_disability` from the row.
   - Build `memberRows` joined by slot. Encrypt SSN via `lib/ssnEncryption.ts` if a full SSN is present; otherwise `ssn_encrypted = null` and store `ssn_last_four` if available. Compute `age` and `signature_required = age >= 18` (use the existing `computeAge` from `route.ts:10-21`, or extract to a shared util).
   - Derive `pbv_full_applications` update payload mirroring `route.ts:455-475` (head_of_household_name, household_size, total_annual_income, dv flags, phone, preferred_language, sms_consent fields if phone set).
   - Re-sync: `DELETE` existing `pbv_household_members` rows for this `full_application_id`, then `INSERT` the new rows. Same DELETE-then-INSERT for `application_documents` (port `route.ts:498-559` — template filter on dv_status / RA / child_support; member-applicability via `getApplicableMembers`).
   - Compensating rollback: if any seeding step throws, DELETE the members you inserted and return 500. Do **not** stamp `intake_status='complete'` on failure.
   - Only on success: update `intake_status='complete'`, `intake_completed_at`. Existing idempotent-replay branch stays.
   - Regression tests in `lib/__tests__/intake-complete-bridge.test.ts`:
     - 1-member EN household: after success, exactly 1 row in `pbv_household_members` with correct fields.
     - 3-adult household: 3 rows, all `signature_required=true`.
     - With minor child: child row has `signature_required=false`.
     - With phone provided: `sms_consent_captured_at` set.
     - Failure mid-seed (mocked): no members linger, `intake_status` not bumped.
     - Idempotent replay: second call to `/intake/complete` returns 200 with existing timestamp, no duplicate rows.
   - Manual smoke: walk a fresh EN tenant link end-to-end through intake, hit Submit, verify `pbv_household_members` materializes. Document the smoke run in the build report.
   Commit: `feat(pbv-intake): bridge intake_data → pbv_household_members + seed application_documents on /complete (F2)`

### Phase 2 — Routing fix

3. **F3** — `components/pbv/intake/SectionReview.tsx`: change `router.push(\`/pbv-full-app/${token}/review\`)` to `router.push(\`/pbv-full-app/${token}/dashboard\`)` (line 212). Delete `app/pbv-full-app/[token]/review/page.tsx`. Confirm no other code links to `/review` (grep `pbv-full-app/.*review` excluding the audit/PRD docs). Regression: simple unit test or grep assertion in `lib/__tests__/section-review-routing.test.ts`.
   Commit: `fix(pbv-intake): SectionReview routes to /dashboard, delete review stub (F3)`

### Phase 3 — Multi-adult form generation

4. **F4** — `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`: refactor the per-template loop (lines 87-188).
   - For `each_adult` and `individual` per-person scopes: compute `requiredSignerIds = members.filter(m => (m.age ?? 0) >= 18).map(m => m.id)`. Build **one** upsert payload per (form_id, language) with `required_signer_member_ids: requiredSignerIds`. No inner per-slot loop.
   - `field_data_snapshot` for multi-adult forms should still include all adults' data (the field map handles row layout; the data dict carries values keyed by slot — confirm `resolveFieldData` already does this; if not, adapt).
   - Submission-level and head_of_household_only scopes unchanged.
   - `getSignerSlots` / `getRequiredSignerIds` helpers: keep or remove; if kept, ensure they're called with the multi-adult union for `each_adult`.
   - Regression test `lib/__tests__/generate-forms-each-adult.test.ts`: 3-adult household → `pbv_form_documents` row for `citizenship_declaration` has `required_signer_member_ids.length === 3`.
   Commit: `fix(pbv-generate-forms): single row per (form_id,language) with union of adult signer ids (F4)`

### Phase 4 — Multi-signer stamping

5. **F5** — `app/api/t/[token]/pbv-full-app/sign-form/route.ts`, the `if (allSigned)` branch (currently lines 209-244):
   - Query `pbv_signature_events` for all rows where `form_document_id = formDoc.id`. Order by `signed_at`.
   - For each event, download `signature_image_path` from `pbv-signatures`. Build a `Map<signer_member_id, Buffer>`. Skip the current signer's download — you already have `sigImageBytes`.
   - For each member in `requiredSignerIds`, look up their `slot` from `pbv_household_members`. Compute `row_index = slot - 1`.
   - Update `buildSignatureFieldData` (lines 318-342) to emit per-row markers: instead of `__sig__`, emit `__sig__:${signer_member_id}` keyed by `__row_pattern:${pattern.data_key}:signature[${row_index}]` (or whatever the existing row-marker convention is — confirm by reading `lib/pbv/form-generation/stamper.ts`).
   - Pass an `imageResolver` to `stampForm` that maps each `__sig__:${id}` to the corresponding buffer in the map.
   - **Verify row formula against `scripts/field-maps/citizenship-declaration-en.json`** before declaring done. HOH should be row 0. Document the verification in the build report.
   - Regression test `lib/__tests__/sign-form-multisigner-stamp.test.ts`: 2-adult household completes signing on `citizenship_declaration`; stamped PDF rendered to PNG; SHA-256 of row-0 and row-1 sig regions differ. (Use existing `scripts/render-stamped.py` or shell out via `mcp__workspace__bash` for image diff; falling back to byte-level distinct-signatures assertion in the field-data dict if PNG diff is impractical in CI.)
   Commit: `fix(pbv-sign-form): stamp per-signer images in allSigned branch (F5)`

### Phase 5 — Resume pointer

6. **F6** — `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`, inside the `mergedIntakeData` construction (currently lines 55-58):
   - Add `_resume_section: section`
   - Add `_last_saved_at: new Date().toISOString()`
   - Regression test `lib/__tests__/intake-resume-pointer.test.ts`: POST to `/intake/income`, read back `intake_data._resume_section === 'income'`.
   Commit: `feat(pbv-intake): write _resume_section + _last_saved_at on every section save (F6)`

### Phase 6 — E2E coverage

7. Update the happy-path E2E to drive intake through the real API instead of the direct-insert helper.
   - Option A: rewrite `tests/e2e/helpers/fillIntakeSection.ts` to use correct slugs (`household`, `contact`, `income`, `zero_income_decl`, `assets`, `childcare_disability`, `criminal_history`, `dv_homeless_ra`) and the `{ data: {...} }` body shape (currently uses wrong slugs and unwrapped body — verify against `/intake/[section]/route.ts:36-39`).
   - Drive `fillMariaIntake` to POST every always-section + applicable conditionals via the corrected helper.
   - Then POST `/intake/complete` (no longer expects 422 for 'review').
   - Replace direct-insert of `pbv_household_members` in `createMariaApplication.ts` for the happy-path with the API-driven version. Keep the direct-insert variant available as `createMariaApplicationFastPath` for tests that don't exercise intake.
   - Run the full E2E suite. Capture new `package-hash.txt`. Update `KNOWN_PACKAGE_HASH` in `tests/e2e/pbv-form-execution-happy-path.spec.ts`.
   Commit: `test(pbv-e2e): drive intake via real API; new KNOWN_PACKAGE_HASH (F2 + E2E coverage)`

### Phase 7 — Build report

8. Write `docs/build-reports/32-pbv-tenant-link-blockers-build-report_2026-05-15.md`. Per commit: what changed, regression test added, deviation from PRD if any. Include:
   - Verification of F5 row formula against actual field map.
   - F2 SSN / income / criminal-history / phone source decisions.
   - F2 manual smoke result.
   - New `KNOWN_PACKAGE_HASH` value.
   - List every audit item from `tenant-link-form-fill-audit_2026-05-15.md` and `pbv-prds-22-30-error-audit` and mark fixed-in-32 / deferred / already-fixed-in-31.

## Verification

After each commit:
- The specific defect's regression test passes
- `tsc --noEmit` clean
- Nothing else broke (run relevant test files)

After all commits:
- `npm run build` clean (do NOT pipe through `Select-Object` on Windows — see CURRENT_STATE.md standing rules)
- All new regression tests pass
- Full Playwright + Vitest E2E green via the API-driven intake path
- New `KNOWN_PACKAGE_HASH` set and stable across runs
- Manual smoke: a real EN solo-HOH walk-through completes from `/pbv-full-app/[token]` to `/finalize` without any DB tooling, link re-paste, or staff intervention

## Anti-patterns — do NOT

- Do NOT bundle multiple defects into one commit
- Do NOT change schema (defer if a fix needs one — surface it)
- Do NOT change the legacy POST at `route.ts:294-587` (it serves `intake_status = null` apps)
- Do NOT skip the F5 row-formula verification — wrong row mapping puts signatures in the wrong adult's slot
- Do NOT keep the direct-insert `createMariaApplication` for the happy-path spec — that's exactly the gap that hid F2
- Do NOT mark a defect fixed in the build report without a regression test (or a documented reason it can't be tested)
- Do NOT introduce new features beyond F1–F6
- Do NOT use `npm run build | Select-Object`

## Audit-the-prompt step

Before implementing, read the PRD and this prompt. Post in chat:
- Any contradiction you find between PRD-32 and the codebase
- Any of the "Decisions still open" you'd answer differently than the recommended default — with rationale
- Any anti-pattern risk you see in F2 (re-sync deletes + re-inserts members; what other rows reference `pbv_household_members.id`? — investigate FK on `pbv_signature_events.signer_member_id`, `pbv_form_documents.required_signer_member_ids`, magic-link tokens, etc.)

Wait for "go" before implementing. If the audit surfaces a real problem with F2's re-sync semantics, surface and adapt — that's exactly what the project workflow expects.

## Build report

`docs/build-reports/32-pbv-tenant-link-blockers-build-report_2026-05-15.md`:
- Summary per defect
- Files changed + commit hash per defect
- Open-decision picks with rationale
- F5 row-formula verification result
- Manual smoke result
- Final test counts (unit + E2E)
- Updated audit reconciliation table
