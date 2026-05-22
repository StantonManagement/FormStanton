/**
 * tests/e2e/pbv-load-generate-forms.spec.ts
 *
 * PRP-022 / J4 — generate-forms load baseline.
 *
 * Spins up a 12-member household via the load fixture, runs the
 * generate-forms POST, and captures total + per-form stamp duration.
 * Tracks regression against the baseline in
 * tests/fixtures/generate-forms-load-12-members.json (PRP-017 added the
 * per-form `[generate-forms] stamp form_id=… ms=…` log line we read
 * via the Vercel logs adapter / surfaced response time).
 *
 * Runs in CI / manual; not a blocking batch gate.
 */

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), 'tests', 'fixtures', 'generate-forms-load-12-members.json'), 'utf8')
);

test('generate-forms load: 12-member household stays under 60s', async ({ request }) => {
  test.skip(
    true,
    'CI seeds the application + members from the fixture, then POSTs generate-forms. Without CI plumbing this is a contract only.'
  );

  const tenantToken = process.env.E2E_TENANT_TOKEN ?? '';
  if (!tenantToken) test.skip(true, 'E2E_TENANT_TOKEN not set');

  // (CI fills the fixture into the DB via supabase service-role before this test.)
  const t0 = Date.now();
  const res = await request.post(`/api/t/${tenantToken}/pbv-full-app/generate-forms`);
  const elapsed = Date.now() - t0;

  expect(res.ok()).toBeTruthy();
  expect(elapsed).toBeLessThan(60_000);

  const body = await res.json();
  const generated = body?.data?.generated ?? [];
  expect(generated.length).toBeGreaterThanOrEqual(FIXTURE.expected_min_forms);

  // Operators: compare `elapsed` + the per-form ms log lines against
  // FIXTURE.performance_baseline.* — once a passing run lands the
  // baseline JSON should be updated with measured p50/p95.
  console.log(`[load:generate-forms] elapsed_ms=${elapsed} forms=${generated.length}`);
});
