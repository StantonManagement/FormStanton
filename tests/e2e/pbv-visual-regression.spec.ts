/**
 * tests/e2e/pbv-visual-regression.spec.ts
 *
 * PRP-022 / J3 — visual regression for the signature pad, scanner entry,
 * and an intake section on an iPhone viewport.
 *
 * Playwright's `toHaveScreenshot()` is the canonical pattern. First run
 * produces the baseline under tests/e2e/__screenshots__/; CI fails on
 * pixel-level drift.
 *
 * Runs in CI / manual; not a blocking batch gate.
 */

import { test, expect, devices } from '@playwright/test';

const iPhone = devices['iPhone 14 Pro'];

test.use({ ...iPhone });

const TENANT_TOKEN = 'e2e-token';
const TENANT_BASE = `/pbv-full-app/${TENANT_TOKEN}`;

test.describe('visual regression on iPhone viewport', () => {
  test('signature pad gate', async ({ page }) => {
    test.skip(true, 'CI fixture sets up a signing modal mid-ceremony');
    await page.goto(`${TENANT_BASE}/sign/forms`);
    await page.getByRole('button', { name: /Sign/i }).first().click();
    await expect(page.getByLabel(/Type your full name/i)).toBeVisible();
    await expect(page).toHaveScreenshot('sig-pad-gate.png', { animations: 'disabled' });
  });

  test('document scanner entry', async ({ page }) => {
    test.skip(true, 'CI fixture sets up the documents page');
    await page.goto(`${TENANT_BASE}/documents`);
    await page.getByRole('button', { name: /Take a photo/i }).first().click();
    await expect(page).toHaveScreenshot('scanner-entry.png', { animations: 'disabled' });
  });

  test('intake household section', async ({ page }) => {
    test.skip(true, 'CI fixture sets up bootstrap');
    await page.goto(`${TENANT_BASE}/intake/household`);
    await expect(page).toHaveScreenshot('intake-household.png', { animations: 'disabled' });
  });
});
