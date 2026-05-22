# PRP-022 — Test-Coverage Backfill (Package Hash, Error Branches, Visual, Load, a11y, Hooks)

**Assigned batch (per BATCH_PLAN.md):** 05
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **J1–J6**.
**Depends on:** None for building the tests themselves — operates on current `main`. (These specs *exercise* features hardened by other PRPs; they author coverage, they do not require those PRPs to compile. Run this PRP **last** in its batch so it can also smoke the accumulated work.)
**Inputs (read before editing):** `tests/e2e/pbv-form-execution-happy-path.spec.ts` (~35 `KNOWN_PACKAGE_HASH = 'UPDATE_ME'`), the existing E2E setup + `tests/snapshots/.../package-hash.txt`, the tenant pages for axe targets, `generate-forms` for a load fixture, the hooks for offline tests.
**Outputs (write — the ONLY files this PRP may modify/create):** `tests/e2e/*` (new specs + the package-hash update), `tests/` fixtures, hook `__tests__/*`. **Do not modify production code** — if a test reveals a real bug, record it as a finding (do not silently change prod to make a test pass).
**Acceptance criteria:**
- `KNOWN_PACKAGE_HASH` is populated from a real passing run (no longer `'UPDATE_ME'`).
- New E2E specs cover error branches (network timeout, 409 `upload_superseded`, 422 `intake_not_complete`, 410 expired link, 500 finalize).
- An axe-core a11y check exists for intake, dashboard, and signing pages.
- A `generate-forms` load fixture (12-member household) establishes a performance baseline.
- Hook unit tests cover offline/retry behavior.

> **Gate exception (important):** the autonomous-batch protocol bans Playwright/e2e *as a blocking batch gate*. This PRP **authors** e2e/axe/load specs as its **deliverable**; it does not run them as a blocking gate in the batch. They become part of CI / the manual verification cadence. The per-PRP gate here is `tsc` + the new **unit/hook** tests only.

## Context (self-contained)
The absence of these gates is the root cause of the audit pile-up (see `AUTONOMOUS-BUILD-LESSONS.md`): no a11y gate, no error-branch coverage, no load baseline, and a placeholder package hash. This PRP builds the coverage so future work can actually gate on these categories. It is the last PRP in the last batch.

## Problem
- **J1:** `KNOWN_PACKAGE_HASH = 'UPDATE_ME'` (integrity drift undetectable).
- **J2:** no E2E error-branch coverage. **J3:** no visual regression for sig-pad/scanner. **J4:** no `generate-forms` load test. **J5:** no axe-core a11y tests. **J6:** no hook offline/retry unit tests.

## Goals
1. **J1:** run the happy-path E2E once; copy the emitted `package-hash.txt` into `KNOWN_PACKAGE_HASH`; document the refresh step in `docs/TESTING.md`.
2. **J2:** `pbv-error-branches.spec.ts` using Playwright `route.fulfill` to simulate failures; assert the UI shows the right error + recovery.
3. **J3:** Playwright screenshot tests for the signature pad, scanner entry, and an intake section on an iPhone viewport.
4. **J4:** a 12-member fixture + a `console.time`-style baseline for `generate-forms`.
5. **J5:** `@axe-core/playwright` scans for intake, dashboard, and signing pages (zero violations target).
6. **J6:** `@testing-library/react` tests for `useIntakeBootstrap`/`useDashboardState`/`useSectionAutoSave` mocking `fetch` 500/timeout/success-after-retry.

## Non-goals
- **No production code changes** (tests only); a real bug found → record as a finding, don't patch prod here. No new CI wiring beyond the specs themselves (CI integration is operational follow-up). Do not edit files outside the Outputs list.

## Implementation
1. Populate `KNOWN_PACKAGE_HASH` from a real run.
2. Author the error-branch, visual, load, axe, and hook specs.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` on the **new hook unit tests** — green. (The e2e/axe/load specs are deliverables run in CI/manual, NOT a blocking batch gate.)
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** in CI/manual, the error-branch + axe + visual + load specs run and pass (or surface real findings to record).
