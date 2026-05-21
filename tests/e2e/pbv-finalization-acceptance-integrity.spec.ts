/**
 * tests/e2e/pbv-finalization-acceptance-integrity.spec.ts
 *
 * PRD-61: Vitest package-integrity assertions for the three acceptance profiles.
 * Mirrors the PRD-30 integrity pattern (pbv-form-execution-package-integrity)
 * but runs against profiles A/B/C from PRD-61.
 *
 * Strategy:
 *  - Find the most-recent submitted test application per profile_key (matched
 *    by the unit_number prefix the profile-application helper injects).
 *  - Assert form count, signer counts, ceremony grouping, document_hash, lock.
 *
 * If a profile has not yet been submitted (Playwright spec didn't run), the
 * relevant describe-block skips with a clear message.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { supabaseTestClient } from './helpers/supabaseTestClient';

import profileA from '../fixtures/profile-a-single-adult.json';
import profileB from '../fixtures/profile-b-multi-adult.json';
import profileC from '../fixtures/profile-c-conditional.json';

interface Fixture {
  profile_key: string;
  application: {
    preferred_language: 'en' | 'es' | 'pt';
    [k: string]: unknown;
  };
  members: Array<{ slot: number; name: string }>;
  expected_forms: {
    generated: string[];
    not_generated_disabled_or_conditional: string[];
    total_generated_count: number;
  };
  expected_signers: {
    hoh_required_form_count: number;
    additional_adult_count: number;
    additional_adult_slot?: number;
    additional_adult_device_owner?: 'hoh_device' | 'self' | null;
  };
}

const profiles: Fixture[] = [
  profileA as unknown as Fixture,
  profileB as unknown as Fixture,
  profileC as unknown as Fixture,
];

async function resolveApplicationIdForProfile(profileKey: string): Promise<string | null> {
  const { data } = await supabaseTestClient
    .from('pbv_full_applications')
    .select('id, unit_number, submitted_at, signing_status')
    .like('unit_number', `%-${profileKey}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || !data.submitted_at) return null;
  return data.id;
}

for (const fixture of profiles) {
  describe(`PRD-61 integrity — ${fixture.profile_key}`, () => {
    let applicationId: string | null = null;
    let formDocs: any[] = [];
    let summaryDoc: any = null;
    let signatureEvents: any[] = [];
    let membersBySlot: Record<number, string> = {};

    beforeAll(async () => {
      applicationId = await resolveApplicationIdForProfile(fixture.profile_key);
      if (!applicationId) return;

      const { data: fd } = await supabaseTestClient
        .from('pbv_form_documents')
        .select('id, form_id, language, status, signed_pdf_path')
        .eq('full_application_id', applicationId);
      formDocs = fd ?? [];

      const { data: sd } = await supabaseTestClient
        .from('pbv_summary_documents')
        .select('id, language, signed_at, template_version')
        .eq('full_application_id', applicationId)
        .maybeSingle();
      summaryDoc = sd;

      const formDocIds = formDocs.map((d) => d.id);
      if (formDocIds.length > 0) {
        const { data: evts } = await supabaseTestClient
          .from('pbv_signature_events')
          .select('id, form_document_id, signer_member_id, device_owner, ceremony_id, document_hash, assisted_by_staff_user_id, signed_at')
          .in('form_document_id', formDocIds);
        signatureEvents = evts ?? [];
      }

      const { data: members } = await supabaseTestClient
        .from('pbv_household_members')
        .select('id, slot')
        .eq('full_application_id', applicationId);
      membersBySlot = Object.fromEntries((members ?? []).map((m: any) => [m.slot, m.id]));
    });

    it('app is submitted (acceptance Playwright spec ran)', () => {
      expect(
        applicationId,
        `No submitted application found for profile ${fixture.profile_key}. Run the Playwright acceptance spec first.`
      ).not.toBeNull();
    });

    it('generates exactly the expected form set', () => {
      if (!applicationId) return;
      const generatedIds = formDocs
        .filter((d) => d.status === 'generated' || d.status === 'signed')
        .map((d) => d.form_id)
        .sort();
      const expected = [...fixture.expected_forms.generated].sort();
      expect(generatedIds).toEqual(expected);
    });

    it('disabled-or-non-firing-conditional templates are absent from package', () => {
      if (!applicationId) return;
      const presentIds = new Set(formDocs.map((d) => d.form_id));
      for (const absent of fixture.expected_forms.not_generated_disabled_or_conditional) {
        expect(presentIds.has(absent), `${absent} should be absent from packaged forms`).toBe(false);
      }
    });

    it('summary doc is signed in the profile language', () => {
      if (!applicationId) return;
      expect(summaryDoc, 'summary doc should exist').toBeTruthy();
      expect(summaryDoc.language).toBe(fixture.application.preferred_language);
      expect(summaryDoc.signed_at).toBeTruthy();
    });

    it('every signature event has a non-empty document_hash', () => {
      if (!applicationId) return;
      for (const evt of signatureEvents) {
        expect(evt.document_hash, `event ${evt.id} missing document_hash`).toBeTruthy();
      }
    });

    it('HOH events share one ceremony_id and have device_owner=self', () => {
      if (!applicationId) return;
      const hohId = membersBySlot[1];
      const hohEvents = signatureEvents.filter((e) => e.signer_member_id === hohId);
      expect(
        hohEvents.length,
        `HOH should sign ${fixture.expected_signers.hoh_required_form_count} forms`
      ).toBe(fixture.expected_signers.hoh_required_form_count);
      const ceremonies = new Set(hohEvents.map((e) => e.ceremony_id));
      expect(ceremonies.size, 'HOH events must share one ceremony_id').toBe(1);
      for (const evt of hohEvents) {
        expect(evt.device_owner).toBe('self');
      }
    });

    it('additional adult (if any) signs on the expected device_owner', () => {
      if (!applicationId) return;
      if (fixture.expected_signers.additional_adult_count === 0) return;
      const slot = fixture.expected_signers.additional_adult_slot ?? 2;
      const memberId = membersBySlot[slot];
      const events = signatureEvents.filter((e) => e.signer_member_id === memberId);
      expect(
        events.length,
        `additional adult slot ${slot} should have signed at least one form`
      ).toBeGreaterThan(0);
      const expected = fixture.expected_signers.additional_adult_device_owner ?? 'hoh_device';
      for (const evt of events) {
        expect(evt.device_owner).toBe(expected);
      }
    });

    it('assisted_by_staff_user_id is null (unassisted profile)', () => {
      if (!applicationId) return;
      for (const evt of signatureEvents) {
        expect(evt.assisted_by_staff_user_id).toBeNull();
      }
    });

    it('signing_status=complete and submitted_at is set', async () => {
      if (!applicationId) return;
      const { data: app } = await supabaseTestClient
        .from('pbv_full_applications')
        .select('signing_status, submitted_at, preferred_language')
        .eq('id', applicationId)
        .single();
      expect(app?.signing_status).toBe('complete');
      expect(app?.submitted_at).toBeTruthy();
      expect(app?.preferred_language).toBe(fixture.application.preferred_language);
    });

    it('post-submit lock holds (mutation returns 409 submitted_locked)', async () => {
      if (!applicationId) return;
      const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
      const { data: app } = await supabaseTestClient
        .from('pbv_full_applications')
        .select('tenant_access_token')
        .eq('id', applicationId)
        .single();
      if (!app?.tenant_access_token) {
        return;
      }
      const res = await fetch(`${baseUrl}/api/t/${app.tenant_access_token}/pbv-full-app/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(409);
    });
  });
}
