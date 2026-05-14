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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
