/**
 * tests/e2e/pbv-finalization-acceptance.spec.ts
 *
 * PRD-61: End-to-end acceptance suite. Three representative household profiles
 * exercised through the same lane as the Maria happy path (PRD-30), each
 * asserting that:
 *   - the generated form set matches the fixture's expected_forms.generated
 *   - signing completes (HOH + additional adult where applicable)
 *   - finalize succeeds, signing_status='complete', submitted_at populated
 *
 * Static execution requires a reachable dev server + test DB (TEST_BASE_URL,
 * SUPABASE_*). When neither is available, this spec compiles + types cleanly
 * but its UI/API walks run as part of the deferred runtime gate (see build
 * report 55b-61).
 *
 * Profile A (single adult, EN) — also acts as control for Profile C: no
 *   conditional addenda.
 * Profile B (multi-adult, EN) — additional adult signs on hoh_device.
 * Profile C (pets + vehicle + self-employment + child-support) — conditional
 *   rules fire; pet/vehicle/self-employment templates are currently disabled
 *   per PRD-55b (Alex deferred). Spec asserts the addenda do NOT appear in
 *   generated[] yet — flagged as cross-PRD residual defect in the build report.
 */

import { test, expect } from '@playwright/test';
import {
  createProfileApplication,
  triggerGenerateForms,
  signSummary,
  signAllFormsForMember,
  exportSubmissionPackage,
  cleanupTestData,
  supabaseTestClient,
} from './helpers';
import type { ProfileFixture } from './helpers';

import profileA from '../fixtures/profile-a-single-adult.json';
import profileB from '../fixtures/profile-b-multi-adult.json';
import profileC from '../fixtures/profile-c-conditional.json';

test.describe.configure({ mode: 'serial' });

interface ProfileRun {
  fixture: ProfileFixture & {
    expected_forms: {
      generated: string[];
      not_generated_disabled_or_conditional: string[];
      total_generated_count: number;
      would_generate_if_sources_present_currently_disabled?: string[];
    };
    expected_signers: {
      hoh_required_form_count: number;
      additional_adult_count: number;
      additional_adult_slot?: number;
      additional_adult_device_owner?: 'hoh_device' | 'self' | null;
    };
  };
}

const PROFILES: ProfileRun[] = [
  { fixture: profileA as any },
  { fixture: profileB as any },
  { fixture: profileC as any },
];

for (const { fixture } of PROFILES) {
  test.describe(`PRD-61 acceptance — ${fixture.profile_key}`, () => {
    let applicationId: string;
    let tenantToken: string;
    let memberIds: Record<number, string>;
    const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

    test.beforeAll(async () => {
      const created = await createProfileApplication(fixture);
      applicationId = created.applicationId;
      tenantToken = created.tenantToken;
      memberIds = created.memberIds;
    });

    test.afterAll(async () => {
      if (applicationId) {
        await cleanupTestData(applicationId);
      }
    });

    test('1 — generate-forms returns the expected enabled-and-conditional set', async () => {
      const formDocs = await triggerGenerateForms(baseUrl, tenantToken);
      const generated = formDocs
        .filter((d) => d.status === 'generated')
        .map((d) => d.form_id)
        .sort();

      const expected = [...fixture.expected_forms.generated].sort();

      expect(
        generated,
        `${fixture.profile_key}: generated set must match fixture (got ${generated.join(',')})`
      ).toEqual(expected);

      // None of the explicitly-disabled or non-firing-conditional templates
      // should leak into generated[].
      for (const absent of fixture.expected_forms.not_generated_disabled_or_conditional) {
        expect(
          generated.includes(absent),
          `${fixture.profile_key}: ${absent} should NOT be generated`
        ).toBe(false);
      }
    });

    test('2 — summary doc + HOH forms sign cleanly', async () => {
      const hohId = memberIds[1];
      const hohName = fixture.members[0].name;

      await signSummary(baseUrl, tenantToken, applicationId, hohName, fixture.application.preferred_language);

      const { data: summary } = await supabaseTestClient
        .from('pbv_summary_documents')
        .select('signed_at, language')
        .eq('full_application_id', applicationId)
        .maybeSingle();
      expect(summary?.signed_at, 'summary doc must be signed').toBeTruthy();
      expect(summary?.language).toBe(fixture.application.preferred_language);

      const { data: formDocs } = await supabaseTestClient
        .from('pbv_form_documents')
        .select('id, required_signer_member_ids')
        .eq('full_application_id', applicationId)
        .eq('status', 'generated');

      const hohFormIds = (formDocs ?? [])
        .filter((d) => (d.required_signer_member_ids as string[] | null)?.includes(hohId))
        .map((d) => d.id);

      const signed = await signAllFormsForMember(
        baseUrl,
        tenantToken,
        applicationId,
        hohId,
        hohName,
        hohFormIds,
        'self'
      );

      expect(
        signed,
        `${fixture.profile_key}: HOH should sign ${fixture.expected_signers.hoh_required_form_count} forms`
      ).toBe(fixture.expected_signers.hoh_required_form_count);

      const { data: events } = await supabaseTestClient
        .from('pbv_signature_events')
        .select('device_owner, ceremony_id, document_hash')
        .eq('signer_member_id', hohId)
        .in('form_document_id', hohFormIds);

      for (const evt of events ?? []) {
        expect(evt.device_owner).toBe('self');
        expect(evt.document_hash, 'document_hash must be set').toBeTruthy();
      }
      const ceremonies = new Set((events ?? []).map((e) => e.ceremony_id));
      expect(ceremonies.size, 'HOH events must share one ceremony_id').toBe(1);
    });

    test('3 — additional adult signs on hoh_device (multi-adult profiles only)', async () => {
      if (fixture.expected_signers.additional_adult_count === 0) {
        test.skip();
        return;
      }
      const slot = fixture.expected_signers.additional_adult_slot ?? 2;
      const adult = fixture.members.find((m) => m.slot === slot);
      expect(adult, `${fixture.profile_key}: profile missing additional adult slot ${slot}`).toBeTruthy();

      const memberId = memberIds[slot];

      const { data: formDocs } = await supabaseTestClient
        .from('pbv_form_documents')
        .select('id, required_signer_member_ids')
        .eq('full_application_id', applicationId)
        .eq('status', 'generated');

      const adultFormIds = (formDocs ?? [])
        .filter((d) => (d.required_signer_member_ids as string[] | null)?.includes(memberId))
        .map((d) => d.id);

      expect(
        adultFormIds.length,
        `${fixture.profile_key}: additional adult must have forms to sign (PRD-56 multi-signer model)`
      ).toBeGreaterThan(0);

      const deviceOwner = fixture.expected_signers.additional_adult_device_owner ?? 'hoh_device';
      await signAllFormsForMember(
        baseUrl,
        tenantToken,
        applicationId,
        memberId,
        adult!.name,
        adultFormIds,
        deviceOwner as 'self' | 'hoh_device'
      );

      const { data: events } = await supabaseTestClient
        .from('pbv_signature_events')
        .select('device_owner')
        .eq('signer_member_id', memberId)
        .in('form_document_id', adultFormIds);

      for (const evt of events ?? []) {
        expect(evt.device_owner).toBe(deviceOwner);
      }
    });

    test('4 — finalize succeeds + submission locks', async () => {
      const res = await fetch(`${baseUrl}/api/t/${tenantToken}/pbv-full-app/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({}),
      });
      expect(res.ok, `finalize failed ${res.status}`).toBeTruthy();

      const { data: app } = await supabaseTestClient
        .from('pbv_full_applications')
        .select('signing_status, submitted_at')
        .eq('id', applicationId)
        .single();

      expect(app?.signing_status).toBe('complete');
      expect(app?.submitted_at).toBeTruthy();

      // Post-submit mutations should be rejected (PRD-56 lock).
      const lockRes = await fetch(`${baseUrl}/api/t/${tenantToken}/pbv-full-app/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({}),
      });
      expect(
        lockRes.status,
        `re-finalize after submit should be rejected as submitted_locked (PRD-56)`
      ).toBe(409);
    });

    test('5 — packaged form set matches expected_forms.generated', async () => {
      const pkg = await exportSubmissionPackage(applicationId);
      const formIds = pkg.formDocuments
        .filter((d) => d.status === 'generated' || d.status === 'signed')
        .map((d) => d.form_id)
        .sort();
      const expected = [...fixture.expected_forms.generated].sort();

      expect(
        formIds.length,
        `${fixture.profile_key}: packaged form count ${formIds.length} != expected ${expected.length}`
      ).toBe(expected.length);

      for (const expectedId of expected) {
        expect(
          formIds.includes(expectedId),
          `${fixture.profile_key}: packaged set missing ${expectedId}`
        ).toBe(true);
      }
    });
  });
}
