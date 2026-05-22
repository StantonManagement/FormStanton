# Testing — PBV Tenant Flow

PRP-022 J1/J3/J4/J5 deliverables operating procedure. The autonomous-build
loop does NOT run these as blocking gates (per the protocol — Playwright
is heavy, slow, and infrastructure-dependent). They live in CI / manual
cadence.

## 1. Package-hash refresh (PRP-022 / J1)

`tests/e2e/pbv-form-execution-happy-path.spec.ts` has a constant
`KNOWN_PACKAGE_HASH` that gates integrity drift. It currently ships as
`'UPDATE_ME'` (the bypass branch). After a real happy-path run:

1. Run the happy-path E2E once:
   `npx playwright test tests/e2e/pbv-form-execution-happy-path.spec.ts`
2. The spec writes `tests/snapshots/.../package-hash.txt` on a pass.
3. Copy that hex value into `KNOWN_PACKAGE_HASH` at the top of the spec
   file and commit.
4. Refresh whenever the form-stack package contract intentionally
   changes (e.g. a new always-required form is added). A bare-eyed
   refresh is fine; the value is content-addressed.

## 2. Visual-regression baselines (PRP-022 / J3)

`tests/e2e/pbv-visual-regression.spec.ts` covers the signature pad,
scanner entry, and intake-household on an iPhone 14 Pro viewport.

1. First run: `npx playwright test tests/e2e/pbv-visual-regression.spec.ts --update-snapshots`.
2. Commit `tests/e2e/__screenshots__/`.
3. Subsequent runs diff against the baseline; failures land as expected/
   actual PNGs in `test-results/`.

## 3. axe-core scans (PRP-022 / J5)

`tests/e2e/pbv-axe-a11y.spec.ts` walks the major tenant surfaces and
fails on any serious/critical violation.

1. Install the peer dep: `npm i -D @axe-core/playwright`.
2. Run: `npx playwright test tests/e2e/pbv-axe-a11y.spec.ts`.
3. Triage hits per the WCAG 2.1 AA tags. Most violations land in the
   per-surface PRPs already (006–009); new ones should fail the build.

## 4. Load baseline (PRP-022 / J4)

`tests/e2e/pbv-load-generate-forms.spec.ts` POSTs `generate-forms` for
a 12-member household and asserts < 60 s.

1. Seed the fixture into a preview DB:
   `node scripts/seed-load-fixture.js tests/fixtures/generate-forms-load-12-members.json`
   (TODO: this script is the follow-up; for now the seeding is manual).
2. Set `E2E_TENANT_TOKEN` to the generated token.
3. Run: `npx playwright test tests/e2e/pbv-load-generate-forms.spec.ts`.
4. Capture the per-form `[generate-forms] stamp form_id=… ms=…` log
   lines (PRP-017 added these). Update the `performance_baseline`
   block in the fixture JSON once a stable p50/p95 is known.

## 5. Hook unit tests (PRP-022 / J6 — per-PRP gate)

Lives next to the hook source under `lib/pbv/hooks/__tests__/`.

- `useDashboardState.test.ts` — partial-failure tolerance (PRP-011).
- `useSectionAutoSave-backup.test.ts` — backup/restore (PRP-012).
- `useSigningCeremony-recovery.test.ts` — sessionStorage recovery (PRP-012).
- `useIntakeBootstrap.test.ts` — happy/404/500/network/reload (PRP-022).

Run them all:
`node node_modules/vitest/dist/cli.js run lib/pbv/hooks/__tests__/`

These ARE the PRP-022 per-batch gate.

## 6. Error-branch E2E (PRP-022 / J2)

`tests/e2e/pbv-error-branches.spec.ts` uses Playwright `route.fulfill`
to simulate 410/409/422/500/timeout. Most cases need a logged-in
tenant fixture; the spec file documents the contract for CI.

## CI integration (operational follow-up)

The PRP-022 specs are authored as deliverables. Wiring them into CI
(GitHub Actions / Vercel preview hooks) is a separate operational
change. Recommended job graph:

```
build → install → vitest run (gating) → playwright install → axe spec
                                       → error-branch spec
                                       → visual spec (baseline check)
                                       → load spec (regression)
```
