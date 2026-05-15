# PRD-30 — PBV Form Execution: End-to-End Test

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** All prior fullApp-Plan PRDs (22–29)
**Depends on:** PRDs 22–29 complete

---

## Problem Statement

PRDs 22–29 build the full PBV form-execution stack. Before declaring it production-ready, a single end-to-end test must walk a synthetic household through the entire flow and assert that the submission package is exactly what HACH should receive.

The test serves three purposes:
1. **Regression guard** — any future change that breaks the flow fails CI
2. **Acceptance criteria** — what "done" looks like for the form-execution build
3. **Reviewer-side preview** — the test artifacts (final submitted package) are reviewable by Dan / HACH without doing live tenant trials

## Test design — the Maria Garcia-Rodriguez household

Canonical household, used across all pilots in PRDs 22+:

| Member | Role | Age | Notes |
|---|---|---|---|
| Maria Garcia-Rodriguez | HOH | 34 | Citizen, PT preferred lang |
| Carlos Garcia-Rodriguez | Spouse | 38 | Eligible non-citizen, immigration doc to upload |
| Diego Garcia-Rodriguez | Adult son | 19 | Citizen, lives elsewhere (forces magic-link path) |
| Sofia Garcia-Rodriguez | Minor child | 8 | Citizen |
| Lucas Garcia-Rodriguez | Minor child | 4 | Citizen |

Conditional triggers in this household:
- VAWA (Q8 = yes) — Maria discloses past DV
- Reasonable Accommodation (Q10 = yes) — Maria requests RA for a medical condition
- Zero-income declaration — Diego is between jobs (forces Section IV)
- Section VI medical — Maria is 62+ disabled? No — disable this trigger. (Modify if you want this to fire.)
- Household-zero-income (Section VIII) — Carlos works construction, household has income, this does NOT fire
- Citizenship Declaration — Carlos's `member_status_2` triggers immigration_doc_set upload

## Test journey

```
1. Admin creates a new pbv_full_applications row + sends Maria the magic link (test helper)
2. Maria taps link → LanguageLanding → picks PT
3. Maria fills intake section by section (helpers fill via API to avoid UI flake)
4. Maria starts section 1, completes 3 sections, hits "Pick up later"
5. Test asserts: resume token re-sent, intake_data persisted
6. Maria taps link again, drops at section 4
7. Maria completes intake (sections 4-11) including conditional VAWA + RA + zero-income-decl
8. Intake/complete called → generate-forms runs → expected forms set produced:
   - Summary doc (PT)
   - Main application (ES)
   - HUD-9886A (ES)
   - HACH release (ES)
   - No-child-support affidavit (ES; mutually exclusive with child-support)
   - Citizenship declaration (ES; HOH + spouse + Diego rows)
   - Obligations of family (ES; HOH + spouse + Diego)
   - EIV guide receipt (ES)
   - Debts owed PHAs (ES)
   - HUD-92006 (ES)
   - Briefing docs certification (ES)
   - Criminal background release (ES)
   - Zero-income statement (ES; for Diego)
   - (4 source-pending forms NOT generated — feature flag off)
9. Test asserts: 13 form documents generated, all `pending_generation` → `generated`, all hashed
10. Maria lands on dashboard
11. Maria reviews + signs summary doc (PT) via signature pad
12. Maria reviews + per-form taps to sign her required forms (~9 forms)
13. Test asserts: 9 pbv_signature_events rows for Maria, all with matching ceremony_id, all with document_hash
14. Maria taps "Other adults need to sign"
15. For Carlos: Maria taps "Sign on this phone now" → handoff prompt → Carlos types name + signs
16. For Diego: Maria taps "Send them their own link" → magic link generated → test follows magic link, Diego signs
17. Test asserts: Carlos events have device_owner='hoh_device'; Diego events have device_owner='self'
18. Maria uploads required documents via existing TenantDocumentUpload (test inserts application_documents rows directly to skip the UI)
19. All dashboard cards complete → Submit enabled → tap Submit
20. Test asserts: pbv_full_applications.signing_status = 'complete', submitted_to_hach_at populated
21. Test exports the final submission package: 13 signed PDFs + summary + audit trail
22. Test asserts package integrity:
   - All PDFs are signed (no in-progress states)
   - Signatures appear on expected forms for expected signers
   - document_hash on each signature event matches the SHA-256 of the PDF state at sign time
   - Language flag in the package = PT
```

## Key decisions

### 1. Playwright + Vitest split

- **Playwright** for browser-driven UI flow (LanguageLanding tap, intake field interactions, signature pad canvas, signing modal taps)
- **Vitest** for API-only assertions (audit row counts, document hashes, feature flag effects)
- One Playwright spec for the happy path; supplemental Vitest specs for assertions that don't need a browser

### 2. Two test specs

- `tests/e2e/pbv-form-execution-happy-path.spec.ts` — Playwright, the full Maria journey
- `tests/e2e/pbv-form-execution-package-integrity.spec.ts` — Vitest, validates the final submission package and audit trail

### 3. Test fixtures

- Maria household JSON fixture in `tests/fixtures/maria-household.json` — same shape as `scripts/sample-data/maria-household.json` from PRD-22
- Sample signature PNG in `tests/fixtures/sample-signature.png` (already exists from PRD-04/13)

### 4. Test database isolation

- Use existing `tests/e2e/helpers/supabaseTestReset.ts` pattern
- One test run = one fresh application + members + cleaned forms tables
- Storage cleanup hook (per test)

### 5. Mock external services

- Twilio: still stubbed (PRD-27); test asserts the send-link call was queued, not delivered
- SMS receipt simulated by extracting `magic_link_token` from the queued send and visiting the URL directly

### 6. Snapshot the final package

The Vitest spec writes the final submission package to `tests/snapshots/pbv-form-execution-maria-package/`:
- 13 signed PDFs
- summary doc (PT, signed)
- audit trail JSON

These snapshots are NOT committed (gitignored), but a hash of the snapshot directory IS committed in `tests/e2e/pbv-form-execution-happy-path.spec.ts` as a contract assertion. Changes to the package shape will fail the assertion; new snapshot must be approved + hash updated.

## Scope

### What this PRD does

- Playwright spec covering the full Maria happy path
- Vitest spec validating the final package + audit trail
- Test helpers + fixtures
- CI workflow extension to run the new specs

### What this PRD does NOT do

- Does not implement any new app code
- Does not modify schema
- Does not cover the 4 source-pending forms (those are feature-flagged off)
- Does not test the staff-assisted mode end-to-end (PRD-29's coverage handles that)
- Does not test the rejection loop (already covered in `pbv-tenant-rejection-loop.spec.ts`)
- Does not test concurrent multi-tenant scenarios

## Affected files

### New tests
- `tests/e2e/pbv-form-execution-happy-path.spec.ts`
- `tests/e2e/pbv-form-execution-package-integrity.spec.ts`

### New helpers
- `tests/e2e/helpers/createMariaApplication.ts`
- `tests/e2e/helpers/fillIntakeSection.ts`
- `tests/e2e/helpers/triggerGenerateForms.ts`
- `tests/e2e/helpers/signSummary.ts`
- `tests/e2e/helpers/signForm.ts`
- `tests/e2e/helpers/extractMagicLinkFromQueue.ts`
- `tests/e2e/helpers/exportSubmissionPackage.ts`

### New fixtures
- `tests/fixtures/maria-household.json`

### Modified
- `.github/workflows/e2e-tenant-flow.yml` — add the new specs
- `playwright.config.ts` — add a project for pbv-form-execution if needed

## Phases

### Phase 1 — Fixtures + helpers

- Author Maria household fixture
- Build the 7 helpers
- Commit: `test(pbv-form-execution): e2e helpers + fixtures`

### Phase 2 — Playwright happy-path spec

- Walk Maria from magic link → intake → resume → finish → sign → submit
- Skip the upload UI (insert documents via helper)
- Spec asserts dashboard state at each major transition
- Commit: `test(pbv-form-execution): playwright happy-path spec`

### Phase 3 — Vitest package-integrity spec

- After happy-path runs, validate package contents
- Assert: form count, signature events, document hashes, language flag
- Snapshot hash check
- Commit: `test(pbv-form-execution): package integrity spec`

### Phase 4 — CI wiring

- Update workflow to run new specs
- Confirm passes in CI (locally first)
- Commit: `ci: pbv-form-execution e2e in CI`

### Phase 5 — Build report

`docs/build-reports/30-pbv-form-execution-e2e-build-report_2026-05-15.md`.

## Out of scope

- Multi-tenant concurrent tests
- Load tests
- Staff-assisted E2E (PRD-29 covers integration; full E2E later)
- The 4 source-pending forms

## Acceptance criteria

- Playwright spec passes locally + in CI
- Vitest package-integrity spec passes
- Snapshot hash matches expectation; any future package-shape change fails this assertion until reviewed
- Test artifacts give Dan/HACH a reviewable sample submission package
- All 9 PBV form execution PRDs (22–30) declared shipped after PRD-30 passes

## Open questions

- Whether to include a "VAWA + RA both fire" specific assertion or trust the Section IX intake answers to imply it. Default: assert presence of vawa_certification and reasonable_accommodation_request in expected forms — but they're feature-flagged off (source-pending), so the assertion is "feature-flag off → NOT in package." Document this is the gate.
- Whether the test should simulate Twilio delivery or only verify the send was queued. Default: queue-only.
- Whether to commit snapshot reference PNGs of the final signed forms for visual review. Default: yes, commit one PNG per form per language as a baseline; update hash when content changes.
