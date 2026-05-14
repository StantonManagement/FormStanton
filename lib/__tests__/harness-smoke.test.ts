/**
 * Harness smoke test — Phase 1 of event-substrate-generalization.
 *
 * Verifies the PGlite harness:
 *   1. Sets up the real migrations schema without errors.
 *   2. Accepts real fixture inserts.
 *   3. Returns the inserted row on SELECT.
 *   4. Rejects constraint violations.
 *
 * The harness now applies supabase/migrations/ via _migration-loader.ts.
 * Tests use the post-migration schema (anchor_type / anchor_id).
 *
 * The deliberately-broken assertion variant is in a comment below.
 * Uncomment it to confirm the harness fails when expected — then revert.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, wipeTestData, rawQuery } from './_db';

const WIPE_ORDER = [
  'application_events',
  'form_submission_document_revisions',
  'form_submission_documents',
  'pbv_full_applications',
  'form_submissions',
];

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await wipeTestData(WIPE_ORDER);
});

// -- Fixture helpers -----------------------------------------------------------

async function seedSubmission(): Promise<string> {
  const rows = await rawQuery<{ id: string }>(
    `INSERT INTO form_submissions (form_type, form_data)
     VALUES ('pbv_full', '{}')
     RETURNING id`
  );
  return rows[0].id;
}

async function seedApplication(submissionId: string): Promise<string> {
  const rows = await rawQuery<{ id: string }>(
    `INSERT INTO pbv_full_applications
       (form_submission_id, building_address, unit_number, head_of_household_name, household_size)
     VALUES ($1, '123 Test St', '1A', 'Doe, Jane', 3)
     RETURNING id`,
    [submissionId]
  );
  return rows[0].id;
}

async function seedDocument(submissionId: string): Promise<string> {
  const rows = await rawQuery<{ id: string }>(
    `INSERT INTO form_submission_documents (form_submission_id, doc_type, label)
     VALUES ($1, 'bank_statement', 'Bank Statement')
     RETURNING id`,
    [submissionId]
  );
  return rows[0].id;
}

// -- Tests ---------------------------------------------------------------------

describe('PGlite harness smoke test', () => {
  it('applies schema without errors (tables exist)', async () => {
    const rows = await rawQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );
    const names = rows.map((r) => r.table_name);
    expect(names).toContain('application_events');
    expect(names).toContain('pbv_full_applications');
    expect(names).toContain('form_submission_documents');
    expect(names).toContain('form_submissions');
  });

  it('inserts fixture rows and retrieves them', async () => {
    const subId = await seedSubmission();
    const appId = await seedApplication(subId);
    const docId = await seedDocument(subId);

    await rawQuery(
      `INSERT INTO application_events
         (anchor_type, anchor_id, event_type, actor_display_name, document_id, payload)
       VALUES ('pbv_full_application', $1, 'document.approved', 'Test Staff', $2, '{"doc_type":"bank_statement","label":"Bank Statement"}')`,
      [appId, docId]
    );

    const events = await rawQuery<{
      anchor_type: string;
      anchor_id: string;
      event_type: string;
      actor_display_name: string;
      payload: Record<string, unknown>;
    }>(
      `SELECT anchor_type, anchor_id, event_type, actor_display_name, payload
       FROM application_events
       WHERE anchor_id = $1`,
      [appId]
    );

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe('document.approved');
    expect(events[0].actor_display_name).toBe('Test Staff');
    expect(events[0].anchor_type).toBe('pbv_full_application');
    expect(events[0].anchor_id).toBe(appId);
    expect((events[0].payload as Record<string, unknown>)['doc_type']).toBe('bank_statement');
  });

  it('rejects INSERT with NULL anchor_type (NOT NULL constraint)', async () => {
    const subId = await seedSubmission();
    const appId = await seedApplication(subId);
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES (NULL, $1, 'document.approved', 'Test Staff', '{}')`,
        [appId]
      )
    ).rejects.toThrow();
  });

  it('rejects INSERT with NULL event_type (NOT NULL constraint)', async () => {
    const subId = await seedSubmission();
    const appId = await seedApplication(subId);
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('pbv_full_application', $1, NULL, 'Test Staff', '{}')`,
        [appId]
      )
    ).rejects.toThrow();
  });

  it('rejects anchor_type not in CHECK constraint', async () => {
    const subId = await seedSubmission();
    const appId = await seedApplication(subId);
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('bad_type', $1, 'document.approved', 'Test Staff', '{}')`,
        [appId]
      )
    ).rejects.toThrow();
  });

  it('wipes data between tests (table is empty at start of each test)', async () => {
    const events = await rawQuery('SELECT id FROM application_events');
    expect(events).toHaveLength(0);
  });

  /*
   * DELIBERATELY BROKEN VARIANT — uncomment to verify the harness fails
   * when the observation breaks. Revert before committing.
   *
   * it('BROKEN: wrong event_type assertion (should fail)', async () => {
   *   const subId = await seedSubmission();
   *   const appId = await seedApplication(subId);
   *   await rawQuery(
   *     `INSERT INTO application_events
   *        (anchor_type, anchor_id, event_type, actor_display_name, payload)
   *      VALUES ('pbv_full_application', $1, 'document.approved', 'Staff', '{}')`,
   *     [appId]
   *   );
   *   const events = await rawQuery<{ event_type: string }>(
   *     'SELECT event_type FROM application_events WHERE anchor_id = $1',
   *     [appId]
   *   );
   *   expect(events[0].event_type).toBe('document.WRONG_VALUE'); // <- will fail
   * });
   */
});
