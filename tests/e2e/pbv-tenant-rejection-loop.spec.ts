import { test, expect, Page } from '@playwright/test';
import { createTestApplication, CreateTestApplicationResult } from './helpers/createTestApplication';
import { cleanupTestData } from './helpers/supabaseTestReset';
import { createRequiredDocument, adminRejectDocument, adminApproveDocument } from './helpers/adminRejectDocument';

test.describe.configure({ mode: 'serial' });

test.describe('PBV Tenant Rejection Round-Trip', () => {
  let testApp: CreateTestApplicationResult;

  test.beforeEach(async () => {
    testApp = await createTestApplication({
      household: { adults: 1, children: 0 },
      buildingAddress: '123 Rejection Test Building',
      unitNumber: `REJ-${Date.now()}`,
      headOfHouseholdName: 'Rejection Test Applicant',
    });
  });

  test.afterEach(async () => {
    if (testApp?.applicationId) {
      await cleanupTestData(testApp.applicationId);
    }
  });

  test('rejection round-trip with localized template in English', async ({ page }) => {
    await runRejectionRoundTrip(page, testApp, 'en');
  });

  test('rejection round-trip with localized template in Spanish', async ({ page }) => {
    await runRejectionRoundTrip(page, testApp, 'es');
  });

  test('rejection round-trip with localized template in Portuguese', async ({ page }) => {
    await runRejectionRoundTrip(page, testApp, 'pt');
  });
});

async function runRejectionRoundTrip(
  page: Page,
  testApp: CreateTestApplicationResult,
  language: 'en' | 'es' | 'pt'
) {
  // Navigate and select language
  await page.goto(`/pbv-full-app/${testApp.tenantToken}`);

  // Select language
  const langButton = language === 'en' ? 'English' : language === 'es' ? 'Español' : 'Português';
  await page.click(`text=${langButton}`);
  await page.click('text=Begin');

  // Complete intake
  await page.fill('[data-testid="hoh-name"]', 'Localized Rejection Test');
  await page.fill('[data-testid="hoh-dob"]', '1985-03-20');
  await page.fill('[data-testid="hoh-ssn"]', '777-88-9999');
  await page.selectOption('[data-testid="hoh-citizenship"]', 'citizen');
  await page.check('[data-testid="income-employment"]');
  await page.fill('[data-testid="annual-income"]', '50000');
  await page.check('[data-testid="cert-checked"]');
  await page.click('text=Continue');

  // Wait for document upload screen
  await expect(page.locator('text=Document Upload')).toBeVisible();

  // Create required documents via helper (simulate admin setup)
  const docId = await createRequiredDocument(
    testApp.applicationId,
    testApp.formSubmissionId,
    'paystub',
    'Recent Pay Stub',
    []
  );

  // Upload the document
  await uploadDocument(page, 'paystub', 'tests/fixtures/sample-paystub.pdf');

  // Admin rejects the document with template key
  await adminRejectDocument({
    applicationId: testApp.applicationId,
    documentId: docId,
    rejectionReasonKey: 'generic:illegible',
    rejectionReasonFreeText: 'Document is blurry and unreadable',
  });

  // Reload tenant page to see rejection
  await page.reload();

  // Verify localized rejection reason renders
  const expectedText = getLocalizedRejectionText(language);
  await expect(page.locator(`text=${expectedText}`)).toBeVisible();

  // Switch language and verify translation
  if (language !== 'en') {
    await page.click('[data-testid="language-switcher"]');
    await page.click('text=English');
    await expect(page.locator(`text=${getLocalizedRejectionText('en')}`)).toBeVisible();
  }

  // Re-upload the document
  await uploadDocument(page, 'paystub', 'tests/fixtures/sample-paystub.pdf');

  // Admin approves the re-uploaded document
  await adminApproveDocument({
    applicationId: testApp.applicationId,
    documentId: docId,
  });

  // Reload and verify status is no longer rejected
  await page.reload();

  // Continue to signatures and complete
  await page.click('text=Continue to Signatures');
  await signAllDocuments(page);
  await page.click('text=Review and Submit');
  await page.click('text=Confirm and Submit');

  await expect(page.locator('text=Application Submitted')).toBeVisible({ timeout: 30000 });
}

function getLocalizedRejectionText(language: 'en' | 'es' | 'pt'): string {
  // These are partial text matches for the localized rejection reasons
  const texts = {
    en: 'illegible',
    es: 'ilegible',
    pt: 'ilegível',
  };
  return texts[language];
}

async function uploadDocument(page: Page, docType: string, filePath: string) {
  const fileInput = page.locator(`[data-testid="upload-${docType}"] input[type="file"]`);
  await fileInput.setInputFiles(filePath);
  await expect(page.locator(`[data-testid="upload-${docType}-complete"]`)).toBeVisible({ timeout: 30000 });
}

async function signAllDocuments(page: Page) {
  const signaturePads = await page.locator('[data-testid="signature-canvas"]').all();
  for (const pad of signaturePads) {
    await pad.click();
    await page.click('[data-testid="save-signature"]');
  }
}
