/**
 * Schema-contract tests — Phase 2 of event-substrate-generalization.
 *
 * These tests assert the LIVE schema (via PGlite) matches what the
 * writeApplicationEvent / writePbvApplicationEvent helpers expect to write.
 *
 * PRE-MIGRATION (Phase 2): asserts full_application_id shape.
 * POST-MIGRATION (Phase 4+): assertions updated to anchor_type / anchor_id shape.
 *
 * This file currently reflects the POST-MIGRATION shape because the
 * generalization migration (Phase 4) has been applied. The schema is
 * the hand-maintained MINIMAL_SCHEMA constant in _db.ts (PBV tables only).
 *
 * If you change a column name or type in application_events, these tests
 * will fail immediately — that's intentional. Update the helper AND these
 * tests together.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, rawQuery } from './_db';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});

// ── Column existence and type assertions ──────────────────────────────────────

describe('application_events column contract (post-migration schema)', () => {
  type ColInfo = { column_name: string; data_type: string; is_nullable: string };

  async function getColumns(): Promise<ColInfo[]> {
    return rawQuery<ColInfo>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'application_events'
       ORDER BY ordinal_position`
    );
  }

  it('has column: id UUID NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'id');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('uuid');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: anchor_type TEXT NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'anchor_type');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: anchor_id UUID NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'anchor_id');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('uuid');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: event_type TEXT NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'event_type');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: actor_user_id TEXT nullable', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'actor_user_id');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('YES');
  });

  it('has column: actor_display_name TEXT NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'actor_display_name');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: document_id UUID nullable', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'document_id');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('uuid');
    expect(col?.is_nullable).toBe('YES');
  });

  it('has column: payload jsonb NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'payload');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('jsonb');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: created_at timestamptz NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'created_at');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('timestamp with time zone');
    expect(col?.is_nullable).toBe('NO');
  });

  it('does NOT have column: full_application_id (dropped in migration)', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'full_application_id');
    expect(col).toBeUndefined();
  });
});

// ── NOT NULL constraint enforcement ──────────────────────────────────────────

describe('application_events NOT NULL enforcement', () => {
  const validAppId = '11111111-1111-1111-1111-111111111111';

  it('rejects NULL anchor_type', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES (NULL, $1, 'document.approved', 'Staff', '{}')`,
        [validAppId]
      )
    ).rejects.toThrow();
  });

  it('rejects NULL anchor_id', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('pbv_full_application', NULL, 'document.approved', 'Staff', '{}')`
      )
    ).rejects.toThrow();
  });

  it('rejects NULL event_type', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('pbv_full_application', $1, NULL, 'Staff', '{}')`,
        [validAppId]
      )
    ).rejects.toThrow();
  });

  it('rejects NULL actor_display_name', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('pbv_full_application', $1, 'document.approved', NULL, '{}')`,
        [validAppId]
      )
    ).rejects.toThrow();
  });
});

// ── CHECK constraint: anchor_type ─────────────────────────────────────────────

describe('application_events CHECK constraint: anchor_type', () => {
  const validAppId = '22222222-2222-2222-2222-222222222222';

  it('accepts anchor_type = pbv_full_application', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('pbv_full_application', $1, 'document.approved', 'Staff', '{}')
         RETURNING id`,
        [validAppId]
      )
    ).resolves.toHaveLength(1);
  });

  it('rejects anchor_type = unknown_type (CHECK violation)', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('unknown_type', $1, 'document.approved', 'Staff', '{}')`,
        [validAppId]
      )
    ).rejects.toThrow();
  });

  it('rejects anchor_type = refi_application (not yet in CHECK)', async () => {
    await expect(
      rawQuery(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('refi_application', $1, 'document.approved', 'Staff', '{}')`,
        [validAppId]
      )
    ).rejects.toThrow();
  });
});

// ── payload column accepts JSONB ──────────────────────────────────────────────

describe('application_events payload column', () => {
  const appId = '33333333-3333-3333-3333-333333333333';

  it('accepts structured JSONB payload', async () => {
    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      `INSERT INTO application_events
         (anchor_type, anchor_id, event_type, actor_display_name, payload)
       VALUES ('pbv_full_application', $1, 'document.approved', 'Staff',
               '{"doc_type":"bank_statement","label":"Bank Statement"}')
       RETURNING payload`,
      [appId]
    );
    expect(rows[0].payload['doc_type']).toBe('bank_statement');
    expect(rows[0].payload['label']).toBe('Bank Statement');
  });

  it('accepts empty JSONB payload {}', async () => {
    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      `INSERT INTO application_events
         (anchor_type, anchor_id, event_type, actor_display_name, payload)
       VALUES ('pbv_full_application', $1, 'document.waived', 'Staff', '{}')
       RETURNING payload`,
      [appId]
    );
    expect(rows[0].payload).toEqual({});
  });
});

// ── resolveAnchor column-match smoke ──────────────────────────────────────────
// Verifies the pbv_full_applications table has the columns resolveAnchor reads.

describe('resolveAnchor column-match: pbv_full_applications', () => {
  type ColInfo = { column_name: string };

  it('table pbv_full_applications exists', async () => {
    const rows = await rawQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_name = 'pbv_full_applications'`
    );
    expect(rows).toHaveLength(1);
  });

  it('has column id', async () => {
    const rows = await rawQuery<ColInfo>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications' AND column_name = 'id'`
    );
    expect(rows).toHaveLength(1);
  });

  it('has column form_submission_id', async () => {
    const rows = await rawQuery<ColInfo>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications' AND column_name = 'form_submission_id'`
    );
    expect(rows).toHaveLength(1);
  });

  it('has column head_of_household_name', async () => {
    const rows = await rawQuery<ColInfo>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications' AND column_name = 'head_of_household_name'`
    );
    expect(rows).toHaveLength(1);
  });

  it('has column packet_locked', async () => {
    const rows = await rawQuery<ColInfo>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications' AND column_name = 'packet_locked'`
    );
    expect(rows).toHaveLength(1);
  });
});

// ── pbv_document_label_translations table contract ────────────────────────────
// PRD-03 Phase 1: Tenant-facing document label translations

describe('pbv_document_label_translations table contract', () => {
  type ColInfo = { column_name: string; data_type: string; is_nullable: string };

  async function getColumns(): Promise<ColInfo[]> {
    return rawQuery<ColInfo>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'pbv_document_label_translations'
       ORDER BY ordinal_position`
    );
  }

  beforeEach(async () => {
    // Clean slate for each test
    await rawQuery(`DELETE FROM pbv_document_label_translations`);
  });

  it('table pbv_document_label_translations exists', async () => {
    const rows = await rawQuery<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_name = 'pbv_document_label_translations'`
    );
    expect(rows).toHaveLength(1);
  });

  it('has column: doc_type TEXT NOT NULL (part of PK)', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'doc_type');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: language TEXT NOT NULL (part of PK)', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'language');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('has column: label TEXT NOT NULL', async () => {
    const cols = await getColumns();
    const col = cols.find((c) => c.column_name === 'label');
    expect(col).toBeDefined();
    expect(col?.data_type).toBe('text');
    expect(col?.is_nullable).toBe('NO');
  });

  it('enforces PK constraint on (doc_type, language)', async () => {
    const insertResult = await rawQuery<{ doc_type: string; language: string }>(
      `INSERT INTO pbv_document_label_translations (doc_type, language, label)
       VALUES ('test_doc', 'en', 'Test')
       RETURNING doc_type, language`
    );
    expect(insertResult).toHaveLength(1);
    expect(insertResult[0].doc_type).toBe('test_doc');
    expect(insertResult[0].language).toBe('en');

    // Duplicate should fail
    await expect(
      rawQuery(
        `INSERT INTO pbv_document_label_translations (doc_type, language, label)
         VALUES ('test_doc', 'en', 'Duplicate')`
      )
    ).rejects.toThrow();
  });

  it('enforces language CHECK constraint (en/es/pt only)', async () => {
    // Valid languages
    for (const lang of ['en', 'es', 'pt']) {
      await expect(
        rawQuery(
          `INSERT INTO pbv_document_label_translations (doc_type, language, label)
           VALUES ('lang_test', '${lang}', 'Label ${lang}')`
        )
      ).resolves.toBeDefined();
    }

    // Invalid language should fail
    await expect(
      rawQuery(
        `INSERT INTO pbv_document_label_translations (doc_type, language, label)
         VALUES ('lang_test', 'fr', 'French Label')`
      )
    ).rejects.toThrow();
  });
});

// ── DOCUMENT_UPLOADED_BY_TENANT event type contract ────────────────────────────

describe('DOCUMENT_UPLOADED_BY_TENANT event type', () => {
  const appId = '44444444-4444-4444-4444-444444444444';

  it('can write document.uploaded_by_tenant event', async () => {
    const rows = await rawQuery<{ id: string; event_type: string }>(
      `INSERT INTO application_events
         (anchor_type, anchor_id, event_type, actor_display_name, payload)
       VALUES ('pbv_full_application', $1, 'document.uploaded_by_tenant', 'Tenant',
               '{"doc_type":"bank_statement","label":"Bank Statement","file_name":"bank.pdf"}')
       RETURNING id, event_type`,
      [appId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('document.uploaded_by_tenant');
  });
});

// ── PRD-04 Notification event types ───────────────────────────────────────────

describe('PRD-04 notification event types', () => {
  const appId = '55550000-5555-5555-5555-555555555555';

  const notifEventTypes = [
    'pbv_full_application.created',
    'notification.scheduled',
    'notification.sent',
    'notification.failed',
    'notification.opted_out',
  ];

  for (const eventType of notifEventTypes) {
    it(`can write ${eventType} event`, async () => {
      const rows = await rawQuery<{ event_type: string }>(
        `INSERT INTO application_events
           (anchor_type, anchor_id, event_type, actor_display_name, payload)
         VALUES ('pbv_full_application', $1, $2, 'system', '{}')
         RETURNING event_type`,
        [appId, eventType]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].event_type).toBe(eventType);
    });
  }
});

// ── PRD-04 pbv_full_applications consent columns ───────────────────────────────

describe('PRD-04 consent columns on pbv_full_applications', () => {
  it('has sms_consent_captured_at column', async () => {
    const cols = await rawQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications'
         AND column_name = 'sms_consent_captured_at'`
    );
    expect(cols).toHaveLength(1);
  });

  it('has sms_consent_text_version column', async () => {
    const cols = await rawQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications'
         AND column_name = 'sms_consent_text_version'`
    );
    expect(cols).toHaveLength(1);
  });

  it('has sms_opted_out_at column', async () => {
    const cols = await rawQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pbv_full_applications'
         AND column_name = 'sms_opted_out_at'`
    );
    expect(cols).toHaveLength(1);
  });
});

// ── PRD-04 tenant_notification_templates table ─────────────────────────────────

describe('tenant_notification_templates table', () => {
  it('enforces (notification_type, language, version) PK', async () => {
    await rawQuery(
      `INSERT INTO tenant_notification_templates
         (notification_type, language, body, version, active)
       VALUES ('magic_link_initial', 'en', 'Test body', 1, true)`
    );
    await expect(
      rawQuery(
        `INSERT INTO tenant_notification_templates
           (notification_type, language, body, version, active)
         VALUES ('magic_link_initial', 'en', 'Duplicate', 1, true)`
      )
    ).rejects.toThrow();
  });

  it('enforces language CHECK (en/es/pt)', async () => {
    await expect(
      rawQuery(
        `INSERT INTO tenant_notification_templates
           (notification_type, language, body)
         VALUES ('magic_link_initial', 'fr', 'French body')`
      )
    ).rejects.toThrow();
  });
});

// ── PRD-04 notification_schedules table ───────────────────────────────────────

describe('notification_schedules table', () => {
  const subId = 'ff000000-0000-0000-0000-000000000001';
  const appId  = 'ff000000-0000-0000-0000-000000000002';

  it('inserts a pending schedule row and enforces status CHECK', async () => {
    await rawQuery(
      `INSERT INTO form_submissions (id, form_type) VALUES ($1, 'pbv-full-application')`,
      [subId]
    );
    await rawQuery(
      `INSERT INTO pbv_full_applications (id, form_submission_id) VALUES ($1, $2)`,
      [appId, subId]
    );

    const rows = await rawQuery<{ status: string }>(
      `INSERT INTO notification_schedules
         (application_id, notification_type, due_at, status)
       VALUES ($1, 'docs_upload_reminder', now() + interval '3 days', 'pending')
       RETURNING status`,
      [appId]
    );
    expect(rows[0].status).toBe('pending');

    await expect(
      rawQuery(
        `INSERT INTO notification_schedules
           (application_id, notification_type, due_at, status)
         VALUES ($1, 'docs_upload_reminder', now(), 'unknown_status')`,
        [appId]
      )
    ).rejects.toThrow();
  });
});
