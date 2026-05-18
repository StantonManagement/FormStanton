# Cursor Prompt — PRD-21: Tenant E2E Test Suite

**PRD:** `docs/21-pbv-tenant-e2e-test-suite_prd_2026-05-14.md`
**Build report:** `docs/build-reports/21-tenant-e2e-build-report_2026-05-14.md`
**Depends on:** PRDs 14-20 all merged. This is the cap-stone verification.

---

## Context

Build a Playwright-based (or harness-matched) E2E test suite covering the five core tenant scenarios. Suite runs in CI on every PR touching tenant code. Catches regressions in any of PRDs 14-20.

---

## Required reading

1. `docs/21-pbv-tenant-e2e-test-suite_prd_2026-05-14.md`
2. `docs/verification-methodology_2026-05-13.md`
3. `package.json` — discover existing test harness and CI scripts
4. `.github/workflows/*` (if exists) — discover CI conventions
5. The build reports for PRDs 14-20 — understand what each scenario tests
6. `app/api/admin/pbv/full-applications/route.ts` — for the createTestApplication helper

---

## Closed decisions

1. Match existing test harness if any; adopt Playwright otherwise.
2. Tests run against real Supabase. No mocks for tenant flow.
3. Five scenarios: 1-adult happy path, 2-adult happy path, rejection round-trip, idempotency replay, re-entry.
4. Mobile viewport (375x667) required for the happy paths at minimum.
5. Real PDF/JPEG fixtures for upload tests.

---

## Open decisions

1. **Harness discovery.** Read `package.json`. Post the existing harness (or "none — adopting Playwright") in chat.
2. **Test DB strategy.** Dedicated Supabase test project vs schema reset between runs vs transactional rollback. Pick one based on what's already set up. Post the choice in chat.
3. **Admin reject helper.** Service-role-key vs admin-auth flow. Read the admin reject endpoint and decide. May need a special helper for Phase 4.

---

## Build this pass

### Commit 1 — Harness setup + helpers

Install harness if needed. Configure for the project.

Build `tests/e2e/helpers/createTestApplication.ts`:

```ts
export async function createTestApplication(opts: {
  household: { adults: number; children: number };
  buildingAddress?: string;
  unitNumber?: string;
}): Promise<{ applicationId: string; tenantToken: string; }> {
  // Call admin API (or direct DB insert) to create a fresh app with a fresh tenant_access_token
  // Return both for use in tests
}
```

Build `tests/e2e/helpers/supabaseTestReset.ts`:

- Per open decision 2: reset, dedicated project, or transactional rollback.

Add fixtures: `tests/fixtures/sample-paystub.pdf`, `tests/fixtures/sample-id.jpg`.

**Done when:** Harness runs. Helpers work. Fixtures exist.

### Commit 2 — Happy path 1-adult

`tests/e2e/pbv-tenant-flow.spec.ts`:

```ts
test('1-adult complete flow', async ({ page }) => {
  const { tenantToken } = await createTestApplication({ household: { adults: 1, children: 0 } });
  await page.goto(`/pbv-full-app/${tenantToken}`);
  await page.click('text=English');
  await page.click('text=Begin');
  // Fill intake form
  // Upload docs (all required, using fixtures)
  // Sign all required signatures
  // Confirm at review screen
  // Wait for confirmed
  await expect(page.locator('text=Application Submitted')).toBeVisible();
  // Reload
  await page.reload();
  // See already_submitted render
  await expect(page.locator('text=Submitted on')).toBeVisible();
});
```

Add mobile variant at 375x667 viewport.

**Done when:** Both variants pass.

### Commit 3 — Happy path 2-adult

`tests/e2e/pbv-tenant-flow.spec.ts`:

```ts
test('2-adult complete flow with handoff and re-sign', async ({ page }) => {
  const { tenantToken } = await createTestApplication({ household: { adults: 2, children: 0 } });
  // Walk through intake, docs, signer 1 signs, handoff to signer 2, signer 2 signs
  // Land on signature review screen
  // Re-sign one doc
  // Confirm submit
  // Verify confirmed state
  // Verify per-signer event rows exist in DB (helper query)
});
```

**Done when:** Test passes. DB inspection confirms `tenant_signer_completed` rows.

### Commit 4 — Rejection round-trip

`tests/e2e/pbv-tenant-rejection-loop.spec.ts`:

```ts
test('rejection round-trip with localized template', async ({ page }) => {
  const { tenantToken, applicationId } = await createTestApplication({ household: { adults: 1, children: 0 } });
  // Complete intake and doc upload
  // Use admin helper to reject one doc with template key 'generic:illegible'
  // Reload tenant page
  // Switch language to Spanish; verify localized rejection reason renders
  // Switch back to English; verify English text
  // Re-upload the doc
  // Verify status returns to 'submitted'
});
```

**Done when:** Test passes in all three languages.

### Commit 5 — Idempotency replay

`tests/e2e/pbv-tenant-flow.spec.ts`:

```ts
test('idempotency replay on tenant writes', async ({ page, request }) => {
  const { tenantToken } = await createTestApplication({ household: { adults: 1, children: 0 } });
  const intakeBody = { /* valid intake payload */ };
  const key = crypto.randomUUID();

  const first = await request.post(`/api/t/${tenantToken}/pbv-full-app`, {
    headers: { 'Idempotency-Key': key },
    data: intakeBody,
  });
  const second = await request.post(`/api/t/${tenantToken}/pbv-full-app`, {
    headers: { 'Idempotency-Key': key },
    data: intakeBody,
  });

  expect(first.status()).toBe(second.status());
  expect(await first.text()).toBe(await second.text());
  // Verify only one set of household member rows exists
});
```

Repeat for signatures POST and finalize POST.

**Done when:** All three replay scenarios pass.

### Commit 6 — Re-entry

`tests/e2e/pbv-tenant-flow.spec.ts`:

```ts
test('returning tenant sees real read-only confirmation', async ({ page }) => {
  // Complete full flow with helper
  // Reload page
  await expect(page.locator('[data-testid="already-submitted-timestamp"]')).toBeVisible();
  await expect(page.locator('[data-testid="already-submitted-docs"]')).toBeVisible();
  await expect(page.locator('[data-testid="already-submitted-signatures"]')).toBeVisible();
  await expect(page.locator('[data-testid="already-submitted-contact"]')).toBeVisible();
  // Verify no mutation affordances
  await expect(page.locator('button:has-text("Submit")')).not.toBeVisible();
  await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
});
```

Add `data-testid` attributes to the PRD-20 render to make this stable.

**Done when:** Test passes. PRD-20 render has stable test IDs.

### Commit 7 — CI workflow

Create `.github/workflows/e2e-tenant-flow.yml` (or platform equivalent):

```yaml
name: E2E Tenant Flow
on:
  pull_request:
    paths:
      - 'app/pbv-full-app/**'
      - 'app/api/t/**'
      - 'components/pbv/**'
      - 'components/review/StantonReviewSurface.tsx'
      - 'lib/pbv/**'
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_ROLE_KEY }}
```

**Done when:** A PR touching tenant code triggers the workflow. A PR not touching it doesn't. The workflow passes on clean main.

### Commit 8 — Deliberate-regression smoke test

On a throwaway branch, revert PRD-15's `setPageState('confirmed')` wiring (line ~1384). Open a PR. Confirm the E2E suite fails with a clear message. Revert the revert.

**Done when:** Suite catches the regression. Build report documents the verification.

---

## Build verification (Windows/PowerShell) — read this before running `npm run build`

PRD-16 lost time to PowerShell behavior. Don't repeat the same trap:

- **Do NOT pipe `npm run build` through `Select-Object -First N` or `-Last N`.** It truncates output before "Compiled successfully" appears, making clean builds look broken or hung. Run `npm run build` directly. If you need to capture output, use `Tee-Object`: `npm run build 2>&1 | Tee-Object build.log`.
- **Do NOT trust PowerShell's implicit exit code for npm commands.** Next.js writes the middleware-to-proxy deprecation warning to stderr, which PowerShell sometimes surfaces as exit code 1 even on a fully successful build. Use `$LASTEXITCODE` for the real node exit code, or inspect output directly.
- **A successful build looks like:** `✓ Compiled successfully in Xs` → `Running TypeScript ...` → `Collecting page data ...` → `Generating static pages ...` → route table prints. Any of the last three steps failing is a real problem. The middleware deprecation warning is NOT.
- If you delete a route file, **clear `.next/` before re-building** (`Remove-Item -Recurse -Force .next`). The cached type validator references the deleted file and causes spurious failures.

---

## Verification

The suite passing on clean main is the verification. Additional one-time:

1. Run suite locally against fresh DB — passes.
2. Run suite locally against DB with existing data — passes.
3. Run on CI from a tenant-code PR — triggers and passes.
4. Run on CI from a non-tenant PR — skipped (CI minutes saved).
5. Deliberate regression (Commit 8) — caught.

---

## Anti-patterns — do NOT

- Do not mock Supabase. Real DB.
- Do not skip the mobile-viewport variant on happy paths.
- Do not pad with more scenarios. Five is the MVP. Adding more is a separate PR.
- Do not use data-URL "fixtures." Real PDF/JPEG files.
- Do not run the E2E suite on every PR. Path-filter it to tenant-touching changes.
- Do not commit the test Supabase credentials. CI secrets only.

---

## Build report

Cover: harness chosen, test DB strategy, deliberate-regression smoke result, runtime per scenario, CI integration status.

Post PR + build report. Don't merge without sign-off.
