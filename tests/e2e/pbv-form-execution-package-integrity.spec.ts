/**
 * tests/e2e/pbv-form-execution-package-integrity.spec.ts
 *
 * PRD-30 — Vitest: Package integrity assertions after the full Maria happy path.
 *
 * This spec runs AFTER the happy-path creates and submits the application.
 * It queries the DB directly to validate the final submission package shape.
 *
 * IMPORTANT: This spec needs a submitted application to query.
 * It looks for the most recent test application matching `test-maria-*` token pattern.
 * If you need an isolated run, set env var MARIA_APPLICATION_ID.
 *
 * What is validated:
 *  1. Form count: exactly 13 generated forms
 *  2. Feature-flagged forms: exactly 4 are NOT present
 *  3. Summary doc: language = pt, signed
 *  4. Signature events: total count, per-signer counts, ceremony grouping
 *  5. device_owner distribution: HOH self, Carlos hoh_device, Diego self
 *  6. document_hash: present on every event
 *  7. assisted_by_staff_user_id: null on all events (unassisted run)
 *  8. Package language flag: pt
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { supabaseTestClient } from './helpers/supabaseTestClient';
import mariaFixture from '../fixtures/maria-household.json';

// Allow explicit override for isolated runs
const EXPLICIT_APP_ID = process.env.MARIA_APPLICATION_ID;

async function resolveApplicationId(): Promise<string> {
  if (EXPLICIT_APP_ID) return EXPLICIT_APP_ID;

  // Find most-recent test-maria application
  const { data } = await supabaseTestClient
    .from('pbv_full_applications')
    .select('id, tenant_access_token, submitted_at')
    .like('tenant_access_token', 'test-maria-%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    throw new Error(
      'Package integrity: no test-maria-* application found. Run happy-path spec first, or set MARIA_APPLICATION_ID.'
    );
  }
  if (!data.submitted_at) {
    throw new Error(
      `Package integrity: application ${data.id} is not yet submitted. Run happy-path spec first.`
    );
  }
  return data.id;
}

describe('PRD-30: Package Integrity', () => {
  let applicationId: string;
  let formDocs: any[];
  let summaryDoc: any;
  let signatureEvents: any[];
  let memberIds: Record<number, string>;

  beforeAll(async () => {
    applicationId = await resolveApplicationId();

    // Load form documents
    const { data: fd } = await supabaseTestClient
      .from('pbv_form_documents')
      .select('id, form_id, language, status, signed_pdf_path')
      .eq('full_application_id', applicationId);
    formDocs = fd ?? [];

    // Load summary doc
    const { data: sd } = await supabaseTestClient
      .from('pbv_summary_documents')
      .select('id, language, signed_at, template_version')
      .eq('full_application_id', applicationId)
      .maybeSingle();
    summaryDoc = sd;

    // Load signature events
    const formDocIds = formDocs.map((d) => d.id);
    const { data: evts } = await supabaseTestClient
      .from('pbv_signature_events')
      .select('id, form_document_id, signer_member_id, device_owner, ceremony_id, document_hash, assisted_by_staff_user_id, signed_at')
      .in('form_document_id', formDocIds.length > 0 ? formDocIds : ['00000000-0000-0000-0000-000000000000']);
    signatureEvents = evts ?? [];

    // Load member IDs
    const { data: members } = await supabaseTestClient
      .from('pbv_household_members')
      .select('id, slot')
      .eq('full_application_id', applicationId);
    memberIds = Object.fromEntries((members ?? []).map((m) => [m.slot, m.id]));
  });

  // ── 1. Form count ───────────────────────────────────────────────────────────
  it('1. generates exactly 13 form documents', () => {
    const generated = formDocs.filter((d) => d.status === 'generated');
    expect(generated.length).toBe(mariaFixture.expected_forms.total_generated_count);
  });

  it('1b. all form documents are in a terminal state', () => {
    for (const doc of formDocs) {
      expect(doc.status, `form ${doc.form_id} is still pending_generation`).not.toBe('pending_generation');
    }
  });

  // ── 2. Feature-flagged forms are NOT present ────────────────────────────────
  it('2. feature-flagged-off forms are absent from package', () => {
    const presentIds = new Set(formDocs.map((d) => d.form_id));
    for (const absent of mariaFixture.expected_forms.not_generated_feature_flag_off) {
      expect(
        presentIds.has(absent),
        `${absent} should be feature-flagged off and NOT in package`
      ).toBe(false);
    }
  });

  // ── 3. Summary doc ─────────────────────────────────────────────────────────
  it('3. summary doc is signed in PT', () => {
    expect(summaryDoc, 'summary document should exist').toBeTruthy();
    expect(summaryDoc.language).toBe('pt');
    expect(summaryDoc.signed_at, 'summary doc must be signed').toBeTruthy();
  });

  // ── 4. Signature events: total count ──────────────────────────────────────
  it('4. total signature events >= 9 (Maria) + Carlos forms + Diego forms', () => {
    // Maria: 9, Carlos: ≥1, Diego: ≥1
    expect(signatureEvents.length).toBeGreaterThanOrEqual(
      mariaFixture.expected_signers.maria_forms_count + 2
    );
  });

  // ── 5. Maria's events: device_owner=self, correct ceremony grouping ────────
  it('5. Maria signature events have device_owner=self and single ceremony_id', () => {
    const mariaId = memberIds[1];
    const mariaEvents = signatureEvents.filter((e) => e.signer_member_id === mariaId);
    expect(mariaEvents.length).toBe(mariaFixture.expected_signers.maria_forms_count);

    for (const evt of mariaEvents) {
      expect(evt.device_owner).toBe('self');
    }
    const ceremonyIds = new Set(mariaEvents.map((e) => e.ceremony_id));
    expect(ceremonyIds.size).toBe(1);
  });

  // ── 6. Carlos: device_owner=hoh_device ────────────────────────────────────
  it('6. Carlos signature events have device_owner=hoh_device', () => {
    const carlosId = memberIds[2];
    const carlosEvents = signatureEvents.filter((e) => e.signer_member_id === carlosId);
    expect(carlosEvents.length).toBeGreaterThan(0);
    for (const evt of carlosEvents) {
      expect(evt.device_owner).toBe('hoh_device');
    }
  });

  // ── 7. Diego: device_owner=self ───────────────────────────────────────────
  it('7. Diego signature events have device_owner=self', () => {
    const diegoId = memberIds[3];
    const diegoEvents = signatureEvents.filter((e) => e.signer_member_id === diegoId);
    expect(diegoEvents.length).toBeGreaterThan(0);
    for (const evt of diegoEvents) {
      expect(evt.device_owner).toBe('self');
    }
  });

  // ── 8. document_hash present on every event ───────────────────────────────
  it('8. every signature event has a non-empty document_hash', () => {
    for (const evt of signatureEvents) {
      expect(evt.document_hash, `event ${evt.id} missing document_hash`).toBeTruthy();
    }
  });

  // ── 9. No staff assistance (unassisted run) ───────────────────────────────
  it('9. assisted_by_staff_user_id is null on all events (unassisted run)', () => {
    for (const evt of signatureEvents) {
      expect(evt.assisted_by_staff_user_id).toBeNull();
    }
  });

  // ── 10. Expected form IDs are present ─────────────────────────────────────
  it('10. all expected form_ids are present in the package', () => {
    const presentIds = new Set(formDocs.map((d) => d.form_id));
    // summary_doc_pt is in pbv_summary_documents, not pbv_form_documents — skip
    const expectedFormIds = mariaFixture.expected_forms.generated.filter(
      (id) => id !== 'summary_doc_pt'
    );
    for (const expected of expectedFormIds) {
      expect(
        presentIds.has(expected),
        `Expected form_id "${expected}" not found in package`
      ).toBe(true);
    }
  });

  // ── 11. Signing status = complete ─────────────────────────────────────────
  it('11. pbv_full_applications.signing_status = complete', async () => {
    const { data: app } = await supabaseTestClient
      .from('pbv_full_applications')
      .select('signing_status, submitted_at')
      .eq('id', applicationId)
      .single();

    expect(app?.signing_status).toBe('complete');
    expect(app?.submitted_at).toBeTruthy();
  });

  // ── 12. Language flag on application ──────────────────────────────────────
  it('12. preferred_language on application = pt', async () => {
    const { data: app } = await supabaseTestClient
      .from('pbv_full_applications')
      .select('preferred_language')
      .eq('id', applicationId)
      .single();

    expect(app?.preferred_language).toBe('pt');
  });
});
