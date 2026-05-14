/**
 * intake-save-path.test.ts
 *
 * Save-path integration tests for the packet intake substrate.
 * Follows docs/verification-methodology_2026-05-13.md.
 *
 * Tests in this file:
 *   - Schema contract: critical column existence, types, constraints
 *   - intake_batches INSERT / UPDATE round-trip
 *   - intake_pages INSERT with FK to intake_batches
 *   - staged_assignment JSONB round-trip (all three target variants)
 *   - CASCADE delete: deleting a batch removes its pages
 *   - status CHECK constraint is enforced
 *   - ocr_confidence CHECK constraint is enforced
 *   - anchor_type CHECK constraint is enforced
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupIntakeTestDb,
  teardownIntakeTestDb,
  wipeIntakeTestData,
  rawIntakeQuery,
} from './_intake_db';

const ANCHOR_ID = '00000000-0000-0000-0000-000000000001';
const ANCHOR_TYPE = 'pbv_full_application';

beforeAll(async () => {
  await setupIntakeTestDb();
});

afterAll(async () => {
  await teardownIntakeTestDb();
});

beforeEach(async () => {
  await wipeIntakeTestData(['intake_pages', 'intake_batches']);
});

// ---------------------------------------------------------------------------
// Schema contract
// ---------------------------------------------------------------------------

describe('Schema contract — intake_batches', () => {
  it('has all required columns', async () => {
    const cols = await rawIntakeQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'intake_batches'`
    );
    const names = cols.map((c) => c.column_name);
    for (const required of [
      'id', 'anchor_type', 'anchor_id', 'status',
      'source_label', 'total_pages', 'committed_at',
      'committed_document_count', 'created_at', 'updated_at',
      'created_by', 'created_by_user_id',
    ]) {
      expect(names, `missing column: ${required}`).toContain(required);
    }
  });

  it('enforces status CHECK constraint', async () => {
    await expect(
      rawIntakeQuery(
        `INSERT INTO intake_batches (anchor_type, anchor_id, status)
         VALUES ($1, $2, $3)`,
        [ANCHOR_TYPE, ANCHOR_ID, 'invalid_status']
      )
    ).rejects.toThrow();
  });

  it('enforces anchor_type CHECK constraint', async () => {
    await expect(
      rawIntakeQuery(
        `INSERT INTO intake_batches (anchor_type, anchor_id, status)
         VALUES ($1, $2, 'uploading')`,
        ['wrong_type', ANCHOR_ID]
      )
    ).rejects.toThrow();
  });

  it('defaults status to uploading', async () => {
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id)
       VALUES ($1, $2, $3)`,
      ['aaaaaaaa-0000-0000-0000-000000000001', ANCHOR_TYPE, ANCHOR_ID]
    );
    const rows = await rawIntakeQuery<{ status: string }>(
      `SELECT status FROM intake_batches WHERE id = $1`,
      ['aaaaaaaa-0000-0000-0000-000000000001']
    );
    expect(rows[0].status).toBe('uploading');
  });
});

describe('Schema contract — intake_pages', () => {
  it('has all required columns', async () => {
    const cols = await rawIntakeQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'intake_pages'`
    );
    const names = cols.map((c) => c.column_name);
    for (const required of [
      'id', 'batch_id', 'source_file_name', 'page_index', 'global_index',
      'image_path', 'extracted_text', 'ocr_confidence', 'suggested_doc_type',
      'suggested_person_slot', 'suggested_score', 'staged_assignment',
      'committed_document_id', 'storage_move_failed', 'created_at',
      'updated_at', 'created_by',
    ]) {
      expect(names, `missing column: ${required}`).toContain(required);
    }
  });

  it('enforces ocr_confidence CHECK constraint', async () => {
    const batchId = 'bbbbbbbb-0000-0000-0000-000000000001';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'uploading')`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID]
    );
    await expect(
      rawIntakeQuery(
        `INSERT INTO intake_pages (batch_id, page_index, global_index, ocr_confidence)
         VALUES ($1, 1, 1, $2)`,
        [batchId, 'excellent']
      )
    ).rejects.toThrow();
  });

  it('defaults storage_move_failed to false', async () => {
    const batchId = 'bbbbbbbb-0000-0000-0000-000000000002';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'uploading')`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID]
    );
    const pageId = 'cccccccc-0000-0000-0000-000000000001';
    await rawIntakeQuery(
      `INSERT INTO intake_pages (id, batch_id, page_index, global_index)
       VALUES ($1, $2, 1, 1)`,
      [pageId, batchId]
    );
    const rows = await rawIntakeQuery<{ storage_move_failed: boolean }>(
      `SELECT storage_move_failed FROM intake_pages WHERE id = $1`,
      [pageId]
    );
    expect(rows[0].storage_move_failed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: batch lifecycle
// ---------------------------------------------------------------------------

describe('intake_batches — INSERT / UPDATE round-trip', () => {
  it('inserts a batch and retrieves it', async () => {
    const batchId = 'dddddddd-0000-0000-0000-000000000001';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status, source_label)
       VALUES ($1, $2, $3, 'uploading', $4)`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID, 'Walk-in 5/14']
    );
    const rows = await rawIntakeQuery<{
      id: string;
      status: string;
      source_label: string;
    }>(
      `SELECT id, status, source_label FROM intake_batches WHERE id = $1`,
      [batchId]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('uploading');
    expect(rows[0].source_label).toBe('Walk-in 5/14');
  });

  it('transitions status through the full lifecycle', async () => {
    const batchId = 'dddddddd-0000-0000-0000-000000000002';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'uploading')`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID]
    );

    for (const status of ['classifying', 'committing', 'committed'] as const) {
      await rawIntakeQuery(
        `UPDATE intake_batches SET status = $1 WHERE id = $2`,
        [status, batchId]
      );
      const rows = await rawIntakeQuery<{ status: string }>(
        `SELECT status FROM intake_batches WHERE id = $1`,
        [batchId]
      );
      expect(rows[0].status).toBe(status);
    }
  });

  it('records total_pages and committed_document_count on commit', async () => {
    const batchId = 'dddddddd-0000-0000-0000-000000000003';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'classifying')`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID]
    );
    await rawIntakeQuery(
      `UPDATE intake_batches
       SET status = 'committed', total_pages = 7, committed_document_count = 3,
           committed_at = now()
       WHERE id = $1`,
      [batchId]
    );
    const rows = await rawIntakeQuery<{
      status: string;
      total_pages: number;
      committed_document_count: number;
      committed_at: string;
    }>(
      `SELECT status, total_pages, committed_document_count, committed_at
       FROM intake_batches WHERE id = $1`,
      [batchId]
    );
    expect(rows[0].status).toBe('committed');
    expect(rows[0].total_pages).toBe(7);
    expect(rows[0].committed_document_count).toBe(3);
    expect(rows[0].committed_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Round-trip: pages with FK
// ---------------------------------------------------------------------------

describe('intake_pages — INSERT with FK', () => {
  it('inserts pages and retrieves them ordered by global_index', async () => {
    const batchId = 'eeeeeeee-0000-0000-0000-000000000001';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'classifying')`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID]
    );

    for (let i = 1; i <= 3; i++) {
      await rawIntakeQuery(
        `INSERT INTO intake_pages
           (batch_id, page_index, global_index, source_file_name, image_path, ocr_confidence)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [batchId, i, i, 'packet.pdf', `${batchId}/${i}.jpg`, 'high']
      );
    }

    const rows = await rawIntakeQuery<{ global_index: number; image_path: string }>(
      `SELECT global_index, image_path FROM intake_pages
       WHERE batch_id = $1 ORDER BY global_index`,
      [batchId]
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.global_index)).toEqual([1, 2, 3]);
    expect(rows[0].image_path).toBe(`${batchId}/1.jpg`);
  });

  it('enforces FK: inserting a page with unknown batch_id throws', async () => {
    await expect(
      rawIntakeQuery(
        `INSERT INTO intake_pages (batch_id, page_index, global_index)
         VALUES ($1, 1, 1)`,
        ['ffffffff-dead-dead-dead-ffffffffffff']
      )
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// staged_assignment JSONB round-trip
// ---------------------------------------------------------------------------

describe('staged_assignment JSONB round-trip', () => {
  async function makeBatch(id: string): Promise<void> {
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'classifying')`,
      [id, ANCHOR_TYPE, ANCHOR_ID]
    );
  }

  async function makePage(batchId: string, pageId: string, globalIndex: number): Promise<void> {
    await rawIntakeQuery(
      `INSERT INTO intake_pages (id, batch_id, page_index, global_index)
       VALUES ($1, $2, $3, $4)`,
      [pageId, batchId, globalIndex, globalIndex]
    );
  }

  it('stores and retrieves a doc_row assignment', async () => {
    const batchId = 'f0000000-0000-0000-0000-000000000001';
    const pageId  = 'f0000000-0000-0000-0000-000000000002';
    const docRowId = 'f0000000-0000-0000-0000-000000000003';
    await makeBatch(batchId);
    await makePage(batchId, pageId, 1);

    const assignment = { target: 'doc_row', doc_row_id: docRowId, group_id: 'grp-1' };
    await rawIntakeQuery(
      `UPDATE intake_pages SET staged_assignment = $1 WHERE id = $2`,
      [JSON.stringify(assignment), pageId]
    );

    const rows = await rawIntakeQuery<{ staged_assignment: typeof assignment }>(
      `SELECT staged_assignment FROM intake_pages WHERE id = $1`,
      [pageId]
    );
    expect(rows[0].staged_assignment).toEqual(assignment);
  });

  it('stores and retrieves a custom assignment', async () => {
    const batchId = 'f1000000-0000-0000-0000-000000000001';
    const pageId  = 'f1000000-0000-0000-0000-000000000002';
    await makeBatch(batchId);
    await makePage(batchId, pageId, 1);

    const assignment = { target: 'custom', custom_label: 'Court Order', group_id: 'grp-2' };
    await rawIntakeQuery(
      `UPDATE intake_pages SET staged_assignment = $1 WHERE id = $2`,
      [JSON.stringify(assignment), pageId]
    );

    const rows = await rawIntakeQuery<{ staged_assignment: typeof assignment }>(
      `SELECT staged_assignment FROM intake_pages WHERE id = $1`,
      [pageId]
    );
    expect(rows[0].staged_assignment.target).toBe('custom');
    expect(rows[0].staged_assignment.custom_label).toBe('Court Order');
  });

  it('stores and retrieves a discard assignment', async () => {
    const batchId = 'f2000000-0000-0000-0000-000000000001';
    const pageId  = 'f2000000-0000-0000-0000-000000000002';
    await makeBatch(batchId);
    await makePage(batchId, pageId, 1);

    const assignment = { target: 'discard' };
    await rawIntakeQuery(
      `UPDATE intake_pages SET staged_assignment = $1 WHERE id = $2`,
      [JSON.stringify(assignment), pageId]
    );

    const rows = await rawIntakeQuery<{ staged_assignment: typeof assignment }>(
      `SELECT staged_assignment FROM intake_pages WHERE id = $1`,
      [pageId]
    );
    expect(rows[0].staged_assignment.target).toBe('discard');
  });

  it('clears staged_assignment to NULL', async () => {
    const batchId = 'f3000000-0000-0000-0000-000000000001';
    const pageId  = 'f3000000-0000-0000-0000-000000000002';
    await makeBatch(batchId);
    await makePage(batchId, pageId, 1);

    await rawIntakeQuery(
      `UPDATE intake_pages SET staged_assignment = $1 WHERE id = $2`,
      [JSON.stringify({ target: 'discard' }), pageId]
    );
    await rawIntakeQuery(
      `UPDATE intake_pages SET staged_assignment = NULL WHERE id = $1`,
      [pageId]
    );

    const rows = await rawIntakeQuery<{ staged_assignment: null }>(
      `SELECT staged_assignment FROM intake_pages WHERE id = $1`,
      [pageId]
    );
    expect(rows[0].staged_assignment).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CASCADE delete
// ---------------------------------------------------------------------------

describe('CASCADE delete', () => {
  it('deleting a batch removes all its pages', async () => {
    const batchId = 'ca5c0000-0000-0000-0000-000000000001';
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'classifying')`,
      [batchId, ANCHOR_TYPE, ANCHOR_ID]
    );
    for (let i = 1; i <= 5; i++) {
      await rawIntakeQuery(
        `INSERT INTO intake_pages (batch_id, page_index, global_index)
         VALUES ($1, $2, $3)`,
        [batchId, i, i]
      );
    }

    const before = await rawIntakeQuery<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM intake_pages WHERE batch_id = $1`,
      [batchId]
    );
    expect(parseInt(before[0].count)).toBe(5);

    await rawIntakeQuery(`DELETE FROM intake_batches WHERE id = $1`, [batchId]);

    const after = await rawIntakeQuery<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM intake_pages WHERE batch_id = $1`,
      [batchId]
    );
    expect(parseInt(after[0].count)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-application isolation
// ---------------------------------------------------------------------------

describe('Cross-application isolation', () => {
  it('querying by anchor_id returns only that application\'s batches', async () => {
    const anchorA = '00000000-aaaa-0000-0000-000000000001';
    const anchorB = '00000000-bbbb-0000-0000-000000000001';

    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'committed')`,
      ['ba000000-0000-0000-0000-000000000001', ANCHOR_TYPE, anchorA]
    );
    await rawIntakeQuery(
      `INSERT INTO intake_batches (id, anchor_type, anchor_id, status)
       VALUES ($1, $2, $3, 'classifying')`,
      ['bb000000-0000-0000-0000-000000000001', ANCHOR_TYPE, anchorB]
    );

    const rowsA = await rawIntakeQuery<{ id: string }>(
      `SELECT id FROM intake_batches WHERE anchor_type = $1 AND anchor_id = $2`,
      [ANCHOR_TYPE, anchorA]
    );
    const rowsB = await rawIntakeQuery<{ id: string }>(
      `SELECT id FROM intake_batches WHERE anchor_type = $1 AND anchor_id = $2`,
      [ANCHOR_TYPE, anchorB]
    );

    expect(rowsA).toHaveLength(1);
    expect(rowsA[0].id).toBe('ba000000-0000-0000-0000-000000000001');
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0].id).toBe('bb000000-0000-0000-0000-000000000001');
  });
});
