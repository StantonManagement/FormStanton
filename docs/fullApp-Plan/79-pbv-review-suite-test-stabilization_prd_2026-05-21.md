# PRD-79 — Review-Suite Test Stabilization

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-stress-test-hardening`
**Status:** Draft — ready for build
**Severity:** P1 — not a runtime defect, but **red CI masks real regressions**, which is itself a launch risk: a genuine break in PBV code can hide in a sea of pre-existing failures.
**Source:** `docs/audits/pbv-stress-test-report_2026-05-21.md` — finding **#7** (HIGH). Walled off in its own PRD because it is **non-PBV code** (the review keyboard-shortcuts suite); keeping it separate so test hygiene never mixes into the PBV route/migration changes.
**Scope guard:** Test files and test config only — and only the failing non-PBV suites. Do **not** change production component behavior to make a test pass unless the test exposed a real bug (if it did, that is a finding to log, and the prod change should be deliberate and noted).

---

## Problem Statement

`vitest run` reports **55 failing tests**, the majority in [components/review/__tests__/useReviewKeyboardShortcuts.test.ts](components/review/__tests__/useReviewKeyboardShortcuts.test.ts) (hook under test: [components/review/useReviewKeyboardShortcuts.ts](components/review/useReviewKeyboardShortcuts.ts)). The PRD-62 build report confirms these are **pre-existing** and **all PBV-specific tests pass** (the stress test re-confirmed 47/47 PBV tests green). So the failures are not a PBV regression — but while they are red, a real PBV regression introduced by PRDs 74–78 (or anything else) would be easy to miss in the noise. The launch decision matrix lists this as "fix soon," not a deploy blocker.

---

## Root cause / findings (to confirm in build — not yet diagnosed in-session)

The audit attributes "the majority of failures" to the review keyboard-shortcuts suite but does not enumerate the 55. The build must **first run the suite and capture the actual failure list and error signatures** before deciding per-suite what to do. [Inference] given the cluster is one hook's test file, the likely cause is a shared setup/teardown or jsdom/testing-library issue (e.g. event-listener wiring, `act()` warnings, or a hooks-order change) rather than 55 independent logic bugs — there is a related known issue in `docs/fullApp-Plan/prompts/review-page-hooks-order-crash_prompt_2026-05-21.md` worth cross-referencing. This is a hypothesis to verify, not a confirmed diagnosis.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| 55 failing tests | mostly `components/review/__tests__/useReviewKeyboardShortcuts.test.ts` | pre-existing per PRD-62 build report; re-confirmed by stress test |
| PBV tests green | the PBV lane | 47/47 pass — not implicated |
| Test runner | `package.json` → `"test": "vitest run"` | run targeted with `npx vitest run <path>` |
| Possibly-related known issue | `prompts/review-page-hooks-order-crash_prompt_2026-05-21.md` | hooks-order crash in the review page |

---

## Goals

1. **Diagnose first:** produce the actual list of the 55 failures grouped by file and error signature (paste into the build report). Do not act before this exists.
2. **Green CI:** `vitest run` exits 0. Reached by fixing the root cause where the test is correct, or — for tests that are genuinely obsolete/duplicated/testing-removed-behavior — quarantining them with `describe.skip`/`it.skip` **plus a `// TODO(stress-test #7): <reason + tracking>` comment and an OPEN-DECISIONS entry** naming each skipped block and why.
3. **No false green:** do not delete tests wholesale and do not weaken assertions to pass. A skip is a logged, reversible decision with a reason; a fix is preferred wherever the test encodes intended behavior.
4. **No prod behavior change to satisfy a test** unless the test revealed a real bug — in which case log it as a new finding and make the prod change deliberately (not as a side effect of "make tests pass").

## Non-goals

- No change to PBV tests (they pass) and no change to PBV production code.
- No migration of the test framework, no broad refactor of the review components.
- Do not chase 100% coverage; the goal is a trustworthy green signal, not new tests.

---

## Implementation phases

### Phase 1 — enumerate
Run `npx vitest run` (and `npx vitest run components/review` for the cluster). Capture: total failures, per-file counts, and 2–3 representative error messages/stack traces per distinct signature. Write this into the build report **before** changing anything.

### Phase 2 — triage each failing suite into one of:
- **(a) Real fix** — the test encodes intended behavior and fails due to a fixable test-setup or assertion-wiring issue (e.g. missing `cleanup()`, wrong event target, stale mock). Fix the test/setup. If the test exposed a genuine prod bug, **stop and log it** as a new finding; do not paper over it.
- **(b) Quarantine** — the test targets removed/changed behavior or is duplicated/obsolete. `*.skip` it with a `// TODO(stress-test #7)` reason and an OPEN-DECISIONS entry. Reversible by design.
- **(c) Flake** — non-deterministic (timing/order). Stabilize (fake timers, deterministic ordering) rather than skip where feasible; if not feasible in-session, quarantine per (b) and log.

Prefer (a) for the keyboard-shortcuts cluster if a single shared cause explains most of them (the [Inference] above) — one setup fix may clear many failures at once.

### Phase 3 — verify green
`npx vitest run` exits 0. Record the final tally (fixed vs skipped) and the list of any skipped blocks in the build report and OPEN-DECISIONS.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1:** the pre-change failure enumeration is captured in the build report.
- **Gate 2:** `npx vitest run` exits 0 (all green or green-with-logged-skips).
- **Gate 3:** every skip has a `// TODO(stress-test #7)` reason **and** an OPEN-DECISIONS entry; count of skipped tests is reported.
- **Gate 4:** PBV tests still 47/47 green (no PBV test was touched or broken).
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean (no prod code changed, or if it was, the reason is logged).

**Deferred (list in build report, do NOT block):**
- **Gate R1:** confirm CI on the PR shows green so future regressions are visible.

---

## Open questions

- **O1:** For suites that are obsolete, skip vs delete? Default: **skip with a reason + OPEN-DECISIONS entry** (reversible, auditable). Delete only if Alex confirms the behavior is gone for good.
- **O2:** Is the keyboard-shortcuts cluster one shared cause or many? Determined in Phase 1; drives whether Phase 2 is one fix or several.

## Decisions

- **D1:** Diagnose-then-act; the failure enumeration precedes any change.
- **D2:** Green via root-cause fix preferred; quarantine-with-reason is the logged fallback, never silent deletion or weakened assertions.
- **D3:** No prod behavior change to satisfy a test unless a real bug is found and logged.

---

## Files expected to change

| File | Change |
|---|---|
| `components/review/__tests__/useReviewKeyboardShortcuts.test.ts` (and any other failing test files found in Phase 1) | fix setup/assertions, or `*.skip` with `// TODO(stress-test #7)` |
| test setup/config (e.g. `vitest.config.*`, `vitest.setup.*`) if a shared cause is found | minimal setup fix |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | list any skipped suites + reasons |

If a failing test turns out to expose a **real production bug**, do not fix it silently — log it as a new finding in OPEN-DECISIONS and surface it in the build report for Alex. If anything outside this list needs changing, default-and-log per BATCH-RUN-PROTOCOL.
