import { test, expect, Page } from '@playwright/test';
import { createTestApplication, CreateTestApplicationResult } from './helpers/createTestApplication';
import { cleanupTestData } from './helpers/supabaseTestReset';
import { createRequiredDocument, adminRejectDocument, adminApproveDocument } from './helpers/adminRejectDocument';

test.describe.configure({ mode: 'serial' });

test.describe('PBV Tenant E2E Flow', () => {
  let testApp: CreateTestApplicationResult;

  test.beforeEach(async () => {
    testApp = await createTestApplication({
      household: { adults: 1, children: 0 },
      buildingAddress: '456 E2E Test Building',
      unitNumber: `E2E-${Date.now()}`,
      headOfHouseholdName: 'E2E Test Applicant',
    });
  });

  test.afterEach(async () => {
    if (testApp?.applicationId) {
      await cleanupTestData(testApp.applicationId);
    }
  });

  test('1-adult complete flow', async ({ page }) => {
    // Navigate to tenant URL
    await page.goto(`/pbv-full-app/${testApp.tenantToken}`);

    // Language selection
    await page.click('text=English');
    await expect(page.locator('text=Begin')).toBeVisible();

    // Begin the application
    await page.click('text=Begin');

    // Fill intake form - Head of Household
    await page.fill('[data-testid="hoh-name"]', 'E2E Test Applicant');
    await page.fill('[data-testid="hoh-dob"]', '1990-01-15');
    await page.fill('[data-testid="hoh-ssn"]', '123-45-6789');

    // Select citizenship status
    await page.selectOption('[data-testid="hoh-citizenship"]', 'citizen');

    // Income section
    await page.check('[data-testid="income-employment"]');
    await page.fill('[data-testid="annual-income"]', '30000');

    // Additional questions
    await page.check('[data-testid="cert-checked"]');

    // Save intake
    await page.click('text=Continue');

    // Wait for document upload screen
    await expect(page.locator('text=Document Upload')).toBeVisible();

    // Upload required documents
    await uploadDocument(page, 'paystub', 'tests/fixtures/sample-paystub.pdf');
    await uploadDocument(page, 'id', 'tests/fixtures/sample-id.jpg');

    // Continue to signatures
    await page.click('text=Continue to Signatures');

    // Sign documents
    await expect(page.locator('text=Signature Required')).toBeVisible();
    await signAllDocuments(page);

    // Review and finalize
    await page.click('text=Review and Submit');
    await expect(page.locator('text=Review Your Application')).toBeVisible();

    // Confirm submission
    await page.click('text=Confirm and Submit');

    // Wait for success screen
    await expect(page.locator('text=Application Submitted')).toBeVisible({ timeout: 30000 });

    // Reload and verify already_submitted state
    await page.reload();
    await expect(page.locator('text=Submitted on')).toBeVisible();
  });

  test('1-adult complete flow - mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to tenant URL
    await page.goto(`/pbv-full-app/${testApp.tenantToken}`);

    // Language selection
    await page.click('text=English');
    await expect(page.locator('text=Begin')).toBeVisible();

    // Begin the application
    await page.click('text=Begin');

    // Fill intake form
    await page.fill('[data-testid="hoh-name"]', 'E2E Mobile Applicant');
    await page.fill('[data-testid="hoh-dob"]', '1985-06-20');
    await page.fill('[data-testid="hoh-ssn"]', '987-65-4321');
    await page.selectOption('[data-testid="hoh-citizenship"]', 'citizen');
    await page.check('[data-testid="income-employment"]');
    await page.fill('[data-testid="annual-income"]', '45000');
    await page.check('[data-testid="cert-checked"]');

    await page.click('text=Continue');

    // Upload documents
    await expect(page.locator('text=Document Upload')).toBeVisible();
    await uploadDocument(page, 'paystub', 'tests/fixtures/sample-paystub.pdf');

    await page.click('text=Continue to Signatures');
    await signAllDocuments(page);

    await page.click('text=Review and Submit');
    await expect(page.locator('text=Review Your Application')).toBeVisible();

    await page.click('text=Confirm and Submit');
    await expect(page.locator('text=Application Submitted')).toBeVisible({ timeout: 30000 });
  });

  test('2-adult complete flow with handoff and re-sign', async ({ page }) => {
    // Create app with 2 adults
    const app2Adult = await createTestApplication({
      household: { adults: 2, children: 0 },
      buildingAddress: '789 2-Adult Building',
      unitNumber: `2ADULT-${Date.now()}`,
      headOfHouseholdName: 'Adult One',
    });

    testApp = app2Adult; // Update for cleanup

    await page.goto(`/pbv-full-app/${app2Adult.tenantToken}`);

    // Language and begin
    await page.click('text=English');
    await page.click('text=Begin');

    // Fill HoH
    await page.fill('[data-testid="hoh-name"]', 'Adult One');
    await page.fill('[data-testid="hoh-dob"]', '1980-03-10');
    await page.fill('[data-testid="hoh-ssn"]', '111-22-3333');
    await page.selectOption('[data-testid="hoh-citizenship"]', 'citizen');

    // Add second adult
    await page.click('text=Add Household Member');
    await page.fill('[data-testid="member-1-name"]', 'Adult Two');
    await page.fill('[data-testid="member-1-dob"]', '1982-07-25');
    await page.fill('[data-testid="member-1-ssn"]', '444-55-6666');
    await page.selectOption('[data-testid="member-1-relationship"]', 'spouse');
    await page.selectOption('[data-testid="member-1-citizenship"]', 'citizen');

    await page.check('[data-testid="income-employment"]');
    await page.fill('[data-testid="annual-income"]', '60000');
    await page.check('[data-testid="cert-checked"]');

    await page.click('text=Continue');

    // Upload docs
    await expect(page.locator('text=Document Upload')).toBeVisible();
    await uploadDocument(page, 'paystub', 'tests/fixtures/sample-paystub.pdf');
    await uploadDocument(page, 'id', 'tests/fixtures/sample-id.jpg');

    await page.click('text=Continue to Signatures');

    // Signer 1 signs
    await expect(page.locator('text=Signature Required')).toBeVisible();
    await page.click('text=Adult One');
    await signAllDocuments(page);

    // Handoff to signer 2
    await expect(page.locator('text=Handoff to Adult Two')).toBeVisible();
    await page.click('text=Continue to Next Signer');

    // Signer 2 signs
    await page.click('text=Adult Two');
    await signAllDocuments(page);

    // Signature review - re-sign one doc
    await expect(page.locator('text=Review Signatures')).toBeVisible();
    await page.click('text=Re-sign'); // First re-sign button
    await signAllDocuments(page);

    // Final review and submit
    await page.click('text=Review and Submit');
    await expect(page.locator('text=Review Your Application')).toBeVisible();
    await page.click('text=Confirm and Submit');

    await expect(page.locator('text=Application Submitted')).toBeVisible({ timeout: 30000 });

    // Verify per-signer events in DB
    const { supabaseTestClient } = await import('./helpers/supabaseTestClient');
    const { data: events } = await supabaseTestClient
      .from('application_events')
      .select('*')
      .eq('application_id', app2Adult.applicationId)
      .eq('event_type', 'tenant_signer_completed');

    expect(events?.length).toBeGreaterThanOrEqual(2);
  });

  test('idempotency replay on tenant writes', async ({ page, request }) => {
    const intakeBody = {
      hohName: 'Idempotency Test',
      hohDob: '1995-05-15',
      hohSsn: '555-66-7777',
      hohCitizenship: 'citizen',
      incomeSources: ['employment'],
      annualIncome: 35000,
      certChecked: true,
    };

    const key = crypto.randomUUID();

    // First request
    const first = await request.post(`/api/t/${testApp.tenantToken}/pbv-full-app`, {
      headers: { 'Idempotency-Key': key },
      data: intakeBody,
    });

    // Second request with same key
    const second = await request.post(`/api/t/${testApp.tenantToken}/pbv-full-app`, {
      headers: { 'Idempotency-Key': key },
      data: intakeBody,
    });

    expect(first.status()).toBe(second.status());
    expect(await first.text()).toBe(await second.text());

    // Verify only one set of household member rows exists
    const { supabaseTestClient } = await import('./helpers/supabaseTestClient');
    const { count } = await supabaseTestClient
      .from('pbv_household_members')
      .select('*', { count: 'exact', head: true })
      .eq('full_application_id', testApp.applicationId);

    expect(count).toBe(1);
  });

  test('returning tenant sees real read-only confirmation', async ({ page }) => {
    // Complete full flow first
    await page.goto(`/pbv-full-app/${testApp.tenantToken}`);
    await page.click('text=English');
    await page.click('text=Begin');

    await page.fill('[data-testid="hoh-name"]', 'Reentry Test');
    await page.fill('[data-testid="hoh-dob"]', '1988-09-12');
    await page.fill('[data-testid="hoh-ssn"]', '999-88-7777');
    await page.selectOption('[data-testid="hoh-citizenship"]', 'citizen');
    await page.check('[data-testid="income-employment"]');
    await page.fill('[data-testid="annual-income"]', '40000');
    await page.check('[data-testid="cert-checked"]');

    await page.click('text=Continue');
    await uploadDocument(page, 'paystub', 'tests/fixtures/sample-paystub.pdf');
    await page.click('text=Continue to Signatures');
    await signAllDocuments(page);
    await page.click('text=Review and Submit');
    await page.click('text=Confirm and Submit');

    await expect(page.locator('text=Application Submitted')).toBeVisible({ timeout: 30000 });

    // Reload page
    await page.reload();

    // Verify read-only confirmation screen
    await expect(page.locator('[data-testid="already-submitted-timestamp"]')).toBeVisible();
    await expect(page.locator('[data-testid="already-submitted-docs"]')).toBeVisible();
    await expect(page.locator('[data-testid="already-submitted-signatures"]')).toBeVisible();
    await expect(page.locator('[data-testid="already-submitted-contact"]')).toBeVisible();

    // Verify no mutation affordances
    await expect(page.locator('button:has-text("Submit")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
  });
});

// Helper functions
async function uploadDocument(page: Page, docType: string, filePath: string) {
  const fileInput = page.locator(`[data-testid="upload-${docType}"] input[type="file"]`);
  await fileInput.setInputFiles(filePath);
  await expect(page.locator(`[data-testid="upload-${docType}-complete"]`)).toBeVisible({ timeout: 30000 });
}

async function signAllDocuments(page: Page) {
  const signaturePads = await page.locator('[data-testid="signature-canvas"]').all();
  for (const pad of signaturePads) {
    await pad.click(); // Simple click as signature
    await page.click('[data-testid="save-signature"]');
  }
}
