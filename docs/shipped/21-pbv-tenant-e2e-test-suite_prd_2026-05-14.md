# PRD-21 — PBV Tenant E2E Test Suite

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Verification / regression prevention
**Sequence:** Spawned from PRD-14 Phase 9.
**Depends on:** All of PRD-14 through PRD-20. The test suite validates everything those PRDs built.
**Blocks:** Nothing. But "do it right" means this test suite exists in CI before the team relies on the tenant flow at scale.

---

## Problem Statement

After PRDs 14-20 ship, the tenant PBV flow has:
- Document categorization (PRD-14)
- Server-side submission lock and finalize endpoint (PRD-15)
- Consolidated API tree, no orphan signing surface (PRD-16)
- Localized rejection reasons (PRD-17)
- Multi-signer correctness with review preview (PRD-18)
- Resilient fetches with idempotency, retries, error UI (PRD-19)
- Real read-only re-entry screen (PRD-20)

Each PRD shipped with its own verification. None of those verifications is a continuously-running regression check. Without an E2E suite in CI, the next debug pass — by Windsurf, Cursor, or anyone — can silently regress any of the above with no signal until a real tenant hits the bug.

This PRD adds a Playwright-based (or whatever existing harness the repo uses) E2E test suite covering the full happy path, the rejection round-trip, the multi-adult flow, idempotency replay, and the already-submitted re-entry. The suite runs in CI on every PR.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| No existing E2E test for tenant PBV flow | Glob `**/*pbv*.spec.*` and `**/*tenant*.spec.*` | [Unverified] — confirm in build phase |
| Existing test harness | [Unverified] — could be Playwright, Cypress, Jest+Testing Library | Read `package.json` `scripts` and `devDependencies` |
| CI configuration | [Unverified] — confirm in build phase | Read `.github/workflows/*` if present |

---

## Key decisions

### 1. Match the existing test harness, don't introduce a new one

If the repo already uses Playwright: extend it. Cypress: extend it. Nothing? Adopt Playwright (industry default for Next.js, free, runs against real browsers, mobile viewport support).

### 2. Tests run against a real Supabase instance, not mocks

The tenant flow depends on RLS, migrations, real document seeding logic. Mocks would catch the wrong bugs. Use a dedicated test project or schema reset between runs.

### 3. Five core test scenarios, no more

The MVP test set:
- Happy path 1-adult: token → intake → docs → signatures → finalize → confirmed → reload → already_submitted
- Happy path 2-adult: same with multi-signer handoff and signature review
- Rejection round-trip: admin rejects with template key → tenant sees localized reason → re-uploads → admin approves
- Idempotency replay: submit each tenant write twice with the same key → second returns stored response
- Re-entry: finalize → reload → see real already_submitted render (not placeholder)

Adding more cases is a separate PR.

### 4. Mobile viewport is required

At least one variant of every test runs at 375x667 (iPhone SE viewport). Desktop runs are nice but mobile is the production case.

### 5. Real document files for upload tests

Test fixtures in `tests/fixtures/` — small PDFs and JPEGs that the upload pipeline accepts. No data-URL hacks.

---

## Scope

### What this PRD does

1. Confirms or adopts the test harness.
2. Adds Supabase test-project setup (or schema reset hooks) so tests don't pollute prod.
3. Builds the five test scenarios listed above.
4. Adds mobile-viewport variants where they catch additional bugs.
5. Adds a CI workflow that runs the suite on every PR touching tenant code.
6. Adds fixtures for document uploads.
7. Adds a helper for creating a fresh test application with a magic token, callable from tests.

### What this PRD does NOT do

- Add visual regression / pixel-diff testing.
- Add load testing.
- Add accessibility audit automation (could be a future PRD).
- Add tests for admin or HACH workflows — those are separate test surfaces.

---

## Affected files

### New files (location depends on existing harness)

| File | What |
|---|---|
| `tests/e2e/pbv-tenant-flow.spec.ts` | Happy path scenarios (1-adult, 2-adult), idempotency replay, re-entry. |
| `tests/e2e/pbv-tenant-rejection-loop.spec.ts` | Admin reject → tenant re-upload round-trip. |
| `tests/e2e/helpers/createTestApplication.ts` | Helper to mint a fresh test application via the admin API, return its tenant token. |
| `tests/e2e/helpers/supabaseTestReset.ts` | Helper to reset the test schema between runs (or use a fresh project). |
| `tests/fixtures/sample-paystub.pdf` | Real PDF fixture. |
| `tests/fixtures/sample-id.jpg` | Real JPEG fixture. |
| `playwright.config.ts` (or harness equivalent) | Configuration for the E2E suite. |
| `.github/workflows/e2e-tenant-flow.yml` (or equivalent) | CI workflow running the suite on tenant-touching PRs. |

### Modified

| File | Change |
|---|---|
| `package.json` | Add `test:e2e` script. Add Playwright (or chosen harness) to devDependencies if not present. |

---

## Phases

### Phase 1 — Harness discovery + setup

| # | Step | Verify |
|---|---|---|
| 1.1 | Confirm or choose harness. If adopting Playwright: install + scaffold. | `npx playwright --version` runs. |
| 1.2 | Set up Supabase test-project or schema reset strategy. Document in the build report. | A test run does not pollute the production DB. |
| 1.3 | Build `createTestApplication` helper. | A test can call it and get back a working tenant token. |

### Phase 2 — Happy path 1-adult

| # | Step | Verify |
|---|---|---|
| 2.1 | Test: navigate to tenant URL → choose language → complete intake → upload all required docs → save all signatures → confirm at review screen → see SuccessScreen → reload → see already_submitted render. | Test passes in CI. |
| 2.2 | Add mobile-viewport variant at 375x667. | Passes. |

### Phase 3 — Happy path 2-adult

| # | Step | Verify |
|---|---|---|
| 3.1 | Same as 2-adult intake, two adult members. Each signer signs their forms, advances, hands off. Last signer reaches review. Re-sign one doc. Confirm submit. SuccessScreen. Reload. already_submitted. | Passes. |
| 3.2 | Verify per-signer event log rows in DB. | Passes. |

### Phase 4 — Rejection round-trip

| # | Step | Verify |
|---|---|---|
| 4.1 | Happy path through doc upload. Admin (via direct API call in test) rejects one doc with a template key. Tenant reloads, sees localized rejection reason (test in all three languages). Tenant re-uploads. Admin approves. Tenant proceeds. | Passes. |

### Phase 5 — Idempotency replay

| # | Step | Verify |
|---|---|---|
| 5.1 | Submit intake twice with the same `Idempotency-Key`. Confirm second call returns the same response, no duplicate household members. | Passes. |
| 5.2 | Same for signature save and document upload. | Passes. |

### Phase 6 — Re-entry

| # | Step | Verify |
|---|---|---|
| 6.1 | Complete the full flow. Reload the page. Confirm the already_submitted render shows: submission timestamp, full doc list, signatures, contact-office card. No mutation affordances visible. | Passes. |

### Phase 7 — CI integration

| # | Step | Verify |
|---|---|---|
| 7.1 | Add `.github/workflows/e2e-tenant-flow.yml` (or equivalent for the platform). Trigger on PRs that touch `app/pbv-full-app/`, `app/api/t/`, `components/pbv/`, `components/review/StantonReviewSurface.tsx`, or `lib/pbv/`. | A PR touching those paths triggers the suite; an untouched PR doesn't waste CI minutes. |
| 7.2 | Confirm the suite passes against a clean main branch. | Pass. |
| 7.3 | Add a deliberate regression (e.g., revert PRD-15's `setPageState('confirmed')` wiring) on a throwaway branch. Confirm the suite fails. | Pass. Revert the regression. |

---

## Verification

The suite passing IS the verification. Additional one-time checks:

1. Run the suite locally against a fresh DB.
2. Run the suite locally against a DB with existing data.
3. Run on CI from a fresh PR.
4. Run on CI from a PR that doesn't touch tenant code — suite is skipped, doesn't burn minutes.
5. Deliberately break one of the PRDs' guarantees on a branch — suite fails with a clear message.

---

## Rollback

- Test files are pure additions.
- CI workflow is additive.
- Fixtures are additive.

Nothing in this PRD touches production code. Worst case: tests are flaky and you skip them in CI until fixed.

---

## Open questions

1. **[Unverified]** Existing test harness. Read `package.json` first.
2. **[Unverified]** Whether the admin reject endpoint is callable from tests with a service-role key, or whether admin auth is more involved. Phase 4 may need a special-case helper.
3. **[Speculation]** Whether mobile-viewport runs catch enough additional bugs to be worth doubling the test runtime. Recommendation: yes for the happy paths (PRDs 2.1 and 3.1); maybe not for rejection/idempotency.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Real Supabase, not mocks | The bugs we care about are at the data + RLS + migration interface. Mocks hide them. |
| 2026-05-14 | Five scenarios, not exhaustive coverage | Time-boxed value. More scenarios after the team sees the suite working. |
| 2026-05-14 | Mobile viewport required | Production case. Desktop is a nice-to-have. |
| 2026-05-14 | Match existing harness | New tooling has tax. The team already knows whatever they already use. |
