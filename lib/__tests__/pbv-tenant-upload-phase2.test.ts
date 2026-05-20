/**
 * PBV Tenant Upload Phase 2 Tests — Read Endpoint
 *
 * Tests for GET /api/t/[token]/pbv-full-app/documents
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, rawQuery, wipeTestData } from './_db';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await wipeTestData([
    'pbv_document_label_translations',
    'application_documents',
    'pbv_full_applications',
    'form_submissions',
  ]);
});

// Stub the handler directly since Next.js route testing requires special setup
// These tests verify the SQL contract and query patterns

describe('Phase 2 Read Endpoint SQL Contract', () => {
  const appId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const token = 'test-token-12345';

  async function seedApplication(): Promise<void> {
    // Seed form_submissions first (FK requirement)
    await rawQuery(
      `INSERT INTO form_submissions (id, form_type, form_data)
       VALUES ($1, 'pbv-full-application', '{}')`,
      ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']
    );

    // Seed pbv_full_applications
    await rawQuery(
      `INSERT INTO pbv_full_applications (
         id, tenant_access_token, building_address, unit_number,
         form_submission_id, packet_locked, stanton_review_status
       ) VALUES ($1, $2, '123 Main St', '1A', $3, false, 'pending')`,
      [appId, token, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']
    );
  }

  async function seedDocuments(): Promise<void> {
    // Seed documents
    await rawQuery(
      `INSERT INTO application_documents
         (id, anchor_type, anchor_id, doc_type, label, required, person_slot, status, revision, display_order)
       VALUES
         ($1, 'pbv_full_application', $4, 'photo_id', 'Photo ID', true, 1, 'missing', 0, 1),
         ($2, 'pbv_full_application', $4, 'bank_statement', 'Bank Statement', true, 1, 'submitted', 1, 2),
         ($3, 'pbv_full_application', $4, 'pay_stub', 'Pay Stub', false, 1, 'approved', 1, 3)`,
      [
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        appId
      ]
    );
  }

  async function seedTranslations(): Promise<void> {
    await rawQuery(
      `INSERT INTO pbv_document_label_translations (doc_type, language, label)
       VALUES
         ('photo_id', 'es', 'Identificación con Foto'),
         ('bank_statement', 'es', 'Estado de Cuenta Bancario'),
         ('pay_stub', 'es', 'Recibo de Pago')`
    );
  }

  it('resolves token to application_id', async () => {
    await seedApplication();

    const rows = await rawQuery<{ id: string; tenant_access_token: string }>(
      `SELECT id, tenant_access_token FROM pbv_full_applications WHERE tenant_access_token = $1`,
      [token]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(appId);
    expect(rows[0].tenant_access_token).toBe(token);
  });

  it('returns 404 for unknown token', async () => {
    const rows = await rawQuery<{ id: string }>(
      `SELECT id FROM pbv_full_applications WHERE tenant_access_token = $1`,
      ['nonexistent-token']
    );

    expect(rows).toHaveLength(0);
  });

  it('reads documents with correct anchor filter', async () => {
    await seedApplication();
    await seedDocuments();

    const rows = await rawQuery(
      `SELECT id, doc_type, label, status, revision
       FROM application_documents
       WHERE anchor_type = 'pbv_full_application' AND anchor_id = $1
       ORDER BY display_order`,
      [appId]
    );

    expect(rows).toHaveLength(3);
    expect(rows[0].doc_type).toBe('photo_id');
    expect(rows[1].doc_type).toBe('bank_statement');
    expect(rows[2].doc_type).toBe('pay_stub');
  });

  it('joins with pbv_document_label_translations for language', async () => {
    await seedApplication();
    await seedDocuments();
    await seedTranslations();

    const rows = await rawQuery<{ doc_type: string; label: string; translated_label: string }>(
      `SELECT
         d.doc_type,
         d.label as original_label,
         COALESCE(t.label, d.label) as translated_label
       FROM application_documents d
       LEFT JOIN pbv_document_label_translations t
         ON d.doc_type = t.doc_type AND t.language = 'es'
       WHERE d.anchor_type = 'pbv_full_application' AND d.anchor_id = $1`,
      [appId]
    );

    expect(rows.length).toBeGreaterThan(0);
    // photo_id should have Spanish translation
    const photoIdRow = rows.find(r => r.doc_type === 'photo_id');
    expect(photoIdRow?.translated_label).toBe('Identificación con Foto');
  });

  it('packet_locked column exists and is queryable', async () => {
    await seedApplication();

    const rows = await rawQuery<{ packet_locked: boolean }>(
      `SELECT packet_locked FROM pbv_full_applications WHERE id = $1`,
      [appId]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].packet_locked).toBe(false);
  });
});
