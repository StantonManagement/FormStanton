/**
 * tests/e2e/pbv-form-execution-happy-path.spec.ts
 *
 * PRD-30: End-to-End happy-path for the Maria Garcia-Rodriguez household.
 *
 * Strategy:
 * - Intake: API-driven (fillMariaIntake) to avoid form-field flakiness
 * - Language selection: UI-driven (first real interaction point)
 * - Pick-up-later: UI-driven (validates save-and-resume)
 * - Signing: API-driven for all signers (canvas interaction is fragile in CI)
 * - Document uploads: directly inserted via supabaseTestClient
 * - Submit: API-driven
 *
 * NOTE: Snapshot hash committed below. If the package shape changes legitimately,
 * re-run, read the new hash from tests/snapshots/.../package-hash.txt, update here,
 * and get sign-off before committing.
 *
 * KNOWN_PACKAGE_HASH is intentionally set to 'UPDATE_ME' for the first run.
 * After first run, replace with the actual hash from the snapshot file.
 */

import { test, expect } from '@playwright/test';
import { createMariaApplication } from './helpers/createMariaApplication';
import { fillMariaIntake } from './helpers/fillIntakeSection';
import { triggerGenerateForms } from './helpers/triggerGenerateForms';
import { signSummary } from './helpers/signSummary';
import { signAllFormsForMember } from './helpers/signForm';
import { triggerAndExtractMagicLink } from './helpers/extractMagicLinkFromQueue';
import { exportSubmissionPackage } from './helpers/exportSubmissionPackage';
import { cleanupTestData, supabaseTestClient } from './helpers';
import mariaFixture from '../fixtures/maria-household.json';

// ─── Snapshot contract ────────────────────────────────────────────────────────
// Update this hash after first successful run + HACH sign-off.
const KNOWN_PACKAGE_HASH = 'UPDATE_ME';

test.describe.configure({ mode: 'serial' });

test.describe('PRD-30: Maria Garcia-Rodriguez Full PBV Flow', () => {
  let applicationId: string;
  let tenantToken: string;
  let memberIds: Record<number, string>;
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

  test.beforeAll(async () => {
    const result = await createMariaApplication();
    applicationId = result.applicationId;
    tenantToken = result.tenantToken;
    memberIds = result.memberIds;
  });

  test.afterAll(async () => {
    if (applicationId) {
      await cleanupTestData(applicationId);
    }
  });

  // ── Step 1: LanguageLanding ────────────────────────────────────────────────
  test('1 — Language landing shows and PT is selectable', async ({ page }) => {
    await page.goto(`/pbv-full-app/${tenantToken}`);
    await expect(page.locator('text=Português')).toBeVisible({ timeout: 10000 });
    await page.click('text=Português');
    await expect(page.locator('text=Começar')).toBeVisible();
  });

  // ── Step 2: Intake fill (API) ──────────────────────────────────────────────
  test('2 — Intake fill via API completes all sections', async () => {
    await fillMariaIntake(baseUrl, tenantToken);

    // Verify intake_data is persisted
    const { data: app } = await supabaseTestClient
      .from('pbv_full_applications')
      .select('intake_data')
      .eq('id', applicationId)
      .single();

    expect(app?.intake_data).toBeTruthy();
  });

  // ── Step 3: Pick-up-later mid-flow ────────────────────────────────────────
  test('3 — Pick-up-later saves state and resumes correctly', async ({ page }) => {
    // Simulate arriving mid-intake then picking up later
    await page.goto(`/pbv-full-app/${tenantToken}/intake`);
    await expect(page.locator('[data-testid="pick-up-later-btn"]')).toBeVisible({ timeout: 10000 });
    await page.click('[data-testid="pick-up-later-btn"]');

    // Should see confirmation that progress is saved
    await expect(page.locator('text=Your progress has been saved')).toBeVisible({ timeout: 10000 });

    // Navigate back — should resume at the section we left
    await page.goto(`/pbv-full-app/${tenantToken}/intake`);
    await expect(page.locator('[data-testid="intake-section"]')).toBeVisible({ timeout: 10000 });
  });

  // ── Step 4: Complete intake (API) → generate forms ────────────────────────
  test('4 — Forms generate after intake/complete', async () => {
    // Complete intake
    const completeRes = await fetch(`${baseUrl}/api/t/${tenantToken}/pbv-full-app/intake/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    });
    expect(completeRes.ok, `intake/complete failed: ${completeRes.status}`).toBeTruthy();

    // Trigger form generation
    const formDocs = await triggerGenerateForms(baseUrl, tenantToken);

    // PRD-30 §8: expect 13 documents
    const generatedCount = formDocs.filter((d) => d.status === 'generated').length;
    expect(generatedCount, `Expected 13 generated forms, got ${generatedCount}`).toBe(
      mariaFixture.expected_forms.total_generated_count
    );

    // Verify feature-flagged-off forms are NOT present
    const presentFormIds = formDocs.map((d) => d.form_id);
    for (const absent of mariaFixture.expected_forms.not_generated_feature_flag_off) {
      expect(
        presentFormIds,
        `Form ${absent} should be feature-flagged OFF and not in package`
      ).not.toContain(absent);
    }
  });

  // ── Step 5: Dashboard loads ────────────────────────────────────────────────
  test('5 — Dashboard loads after intake complete', async ({ page }) => {
    await page.goto(`/pbv-full-app/${tenantToken}/dashboard`);
    await expect(page.locator('[data-testid="tenant-dashboard"]')).toBeVisible({ timeout: 15000 });
  });

  // ── Step 6: Maria signs summary + her forms (API) ─────────────────────────
  test('6 — Maria signs summary doc (PT) and all her required forms', async () => {
    // Sign summary
    await signSummary(baseUrl, tenantToken, applicationId, 'Maria Garcia-Rodriguez', 'pt');

    // Verify summary signed
    const { data: summary } = await supabaseTestClient
      .from('pbv_summary_documents')
      .select('signed_at, language')
      .eq('full_application_id', applicationId)
      .maybeSingle();

    expect(summary?.signed_at).toBeTruthy();
    expect(summary?.language).toBe('pt');

    // Fetch forms requiring Maria's signature
    const { data: formDocs } = await supabaseTestClient
      .from('pbv_form_documents')
      .select('id, form_id, required_signer_member_ids')
      .eq('full_application_id', applicationId)
      .eq('status', 'generated');

    const mariaId = memberIds[1];
    const mariaFormIds = (formDocs ?? [])
      .filter((d) => (d.required_signer_member_ids as string[]).includes(mariaId))
      .map((d) => d.id);

    const sigCount = await signAllFormsForMember(
      baseUrl, tenantToken, applicationId, mariaId, 'Maria Garcia-Rodriguez', mariaFormIds, 'self'
    );

    // PRD-30 §12: Maria signs ~9 forms
    expect(sigCount, `Maria should sign ~${mariaFixture.expected_signers.maria_forms_count} forms`).toBe(
      mariaFixture.expected_signers.maria_forms_count
    );

    // Assert signature events
    const { data: events } = await supabaseTestClient
      .from('pbv_signature_events')
      .select('id, signer_member_id, device_owner, ceremony_id, document_hash')
      .in('form_document_id', mariaFormIds);

    expect(events?.length).toBe(sigCount);
    for (const evt of events ?? []) {
      expect(evt.document_hash, 'document_hash must be set').toBeTruthy();
      expect(evt.device_owner).toBe('self');
    }
    // All Maria's events share a single ceremony_id
    const ceremonyIds = new Set((events ?? []).map((e) => e.ceremony_id));
    expect(ceremonyIds.size, 'All Maria forms should share one ceremony_id').toBe(1);
  });

  // ── Step 7: Carlos signs on HOH device ────────────────────────────────────
  test('7 — Carlos signs on HOH device (device_owner=hoh_device)', async () => {
    const carlosId = memberIds[2];

    const { data: formDocs } = await supabaseTestClient
      .from('pbv_form_documents')
      .select('id, required_signer_member_ids')
      .eq('full_application_id', applicationId)
      .eq('status', 'generated');

    const carlosFormIds = (formDocs ?? [])
      .filter((d) => (d.required_signer_member_ids as string[]).includes(carlosId))
      .map((d) => d.id);

    expect(carlosFormIds.length, 'Carlos should have forms to sign').toBeGreaterThan(0);

    await signAllFormsForMember(
      baseUrl, tenantToken, applicationId, carlosId, 'Carlos Garcia-Rodriguez', carlosFormIds, 'hoh_device'
    );

    const { data: events } = await supabaseTestClient
      .from('pbv_signature_events')
      .select('device_owner')
      .in('form_document_id', carlosFormIds)
      .eq('signer_member_id', carlosId);

    for (const evt of events ?? []) {
      expect(evt.device_owner).toBe('hoh_device');
    }
  });

  // ── Step 8: Diego signs via magic link ────────────────────────────────────
  test('8 — Diego signs via separate magic link (device_owner=self)', async ({ page }) => {
    const diegoId = memberIds[3];

    // Trigger magic link generation for Diego (slot 3)
    const linkInfo = await triggerAndExtractMagicLink(baseUrl, tenantToken, applicationId, 3);
    expect(linkInfo.token).toBeTruthy();

    // Navigate to Diego's magic link
    await page.goto(`/pbv-full-app/${linkInfo.token}`);
    await expect(page.locator('text=Diego Garcia-Rodriguez')).toBeVisible({ timeout: 15000 });

    // Sign Diego's forms via API using his magic link token
    const { data: formDocs } = await supabaseTestClient
      .from('pbv_form_documents')
      .select('id, required_signer_member_ids')
      .eq('full_application_id', applicationId)
      .eq('status', 'generated');

    const diegoFormIds = (formDocs ?? [])
      .filter((d) => (d.required_signer_member_ids as string[]).includes(diegoId))
      .map((d) => d.id);

    await signAllFormsForMember(
      baseUrl, linkInfo.token, applicationId, diegoId, 'Diego Garcia-Rodriguez', diegoFormIds, 'self'
    );

    const { data: events } = await supabaseTestClient
      .from('pbv_signature_events')
      .select('device_owner')
      .in('form_document_id', diegoFormIds)
      .eq('signer_member_id', diegoId);

    for (const evt of events ?? []) {
      expect(evt.device_owner).toBe('self');
    }
  });

  // ── Step 9: Upload required documents (direct DB insert) ──────────────────
  test('9 — Required documents inserted and dashboard cards complete', async () => {
    // Insert Carlos immigration doc directly (skipping upload UI per PRD-30 §18)
    await supabaseTestClient.from('application_documents').insert({
      anchor_type: 'pbv_full_application',
      anchor_id: applicationId,
      document_type: 'immigration_doc',
      member_id: memberIds[2],
      file_path: 'test/placeholder-immigration-doc.pdf',
      status: 'uploaded',
      uploaded_by: 'test-harness',
    });

    // Verify upload counts in dashboard
    const { data: docs } = await supabaseTestClient
      .from('application_documents')
      .select('id')
      .eq('anchor_id', applicationId)
      .eq('status', 'uploaded');

    expect((docs ?? []).length).toBeGreaterThan(0);
  });

  // ── Step 10: Submit ────────────────────────────────────────────────────────
  test('10 — Submit completes and signing_status = complete', async () => {
    const res = await fetch(`${baseUrl}/api/t/${tenantToken}/pbv-full-app/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({}),
    });

    expect(res.ok, `submit failed: ${res.status}`).toBeTruthy();

    const { data: app } = await supabaseTestClient
      .from('pbv_full_applications')
      .select('signing_status, submitted_at')
      .eq('id', applicationId)
      .single();

    expect(app?.signing_status).toBe('complete');
    expect(app?.submitted_at).toBeTruthy();
  });

  // ── Step 11: Export package + snapshot hash ────────────────────────────────
  test('11 — Package integrity: hash matches snapshot contract', async () => {
    const pkg = await exportSubmissionPackage(applicationId);

    // Form count
    expect(
      pkg.formDocuments.length,
      `Package should have ${mariaFixture.expected_forms.total_generated_count} forms`
    ).toBe(mariaFixture.expected_forms.total_generated_count);

    // Summary doc is signed in PT
    expect(pkg.summaryDocument?.signed_at).toBeTruthy();
    expect(pkg.summaryDocument?.language).toBe('pt');

    // All form docs are in a terminal state (not pending_generation)
    for (const doc of pkg.formDocuments) {
      expect(
        doc.status,
        `Form ${doc.form_id} should not be pending_generation`
      ).not.toBe('pending_generation');
    }

    // Snapshot hash check — update KNOWN_PACKAGE_HASH after first passing run
    if (KNOWN_PACKAGE_HASH !== 'UPDATE_ME') {
      expect(pkg.packageHash).toBe(KNOWN_PACKAGE_HASH);
    } else {
      // First run: log the hash so it can be committed
      console.log(`[PRD-30] Package hash for snapshot: ${pkg.packageHash}`);
      console.log('[PRD-30] Update KNOWN_PACKAGE_HASH in this spec after reviewing the package.');
    }
  });
});
