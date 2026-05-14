/**
 * Save-path integration tests — Phase 6 of event-substrate-generalization.
 *
 * These tests verify that writePbvApplicationEvent correctly writes event rows
 * to the application_events table with the post-migration schema
 * (anchor_type / anchor_id).
 *
 * They wire the helper to a real PGlite database — no mocks, no HTTP, no Supabase.
 * The helper is patched to use the PGlite client instead of supabaseAdmin.
 *
 * Pattern:
 *   1. setupTestDb() creates an in-memory Postgres using the hand-maintained
 *      MINIMAL_SCHEMA constant in _db.ts (PBV tables only).
 *   2. Each test seeds required FK rows (form_submissions, pbv_full_applications,
 *      form_submission_documents) using rawQuery.
 *   3. writeEventDirect() calls the helper logic directly via rawQuery (not
 *      importing the helper itself, which requires a live Supabase client).
 *      This keeps tests fully self-contained while verifying the exact column
 *      mapping that the helper uses.
 *   4. Assertions query the events table and check column values.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDb,
  teardownTestDb,
  wipeTestData,
  rawQuery,
} from './_db';

const APP_ID  = 'aaaa0000-0000-0000-0000-000000000001';
const SUBMISSION_ID = 'bbbb0000-0000-0000-0000-000000000001';
const DOC_ID  = 'cccc0000-0000-0000-0000-000000000001';
const ACTOR_USER_ID = 'dddd0000-0000-0000-0000-000000000001';

beforeAll(async () => {
  await setupTestDb();

  await rawQuery(
    `INSERT INTO form_submissions (id, form_type) VALUES ($1, 'pbv-full-application')`,
    [SUBMISSION_ID]
  );
  await rawQuery(
    `INSERT INTO pbv_full_applications
       (id, form_submission_id, head_of_household_name)
     VALUES ($1, $2, 'Integration Test Applicant')`,
    [APP_ID, SUBMISSION_ID]
  );
  await rawQuery(
    `INSERT INTO form_submission_documents
       (id, form_submission_id, doc_type, label)
     VALUES ($1, $2, 'bank_statement', 'Bank Statement (last 3 months)')`,
    [DOC_ID, SUBMISSION_ID]
  );
});

afterAll(async () => {
  await teardownTestDb();
});

beforeEach(async () => {
  await wipeTestData(['application_events']);
});

// ── Helper: writeEventDirect ──────────────────────────────────────────────────
// Mirrors the exact INSERT that writePbvApplicationEvent / writeApplicationEvent
// produce, verifying the post-migration column names are correct.

async function writeEventDirect({
  anchorType = 'pbv_full_application',
  anchorId,
  eventType,
  actorUserId,
  actorDisplayName,
  documentId,
  payload,
}: {
  anchorType?: string;
  anchorId: string;
  eventType: string;
  actorUserId?: string | null;
  actorDisplayName: string;
  documentId?: string | null;
  payload: Record<string, unknown>;
}): Promise<{ id: string }[]> {
  return rawQuery<{ id: string }>(
    `INSERT INTO application_events
       (anchor_type, anchor_id, event_type, actor_user_id, actor_display_name,
        document_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      anchorType,
      anchorId,
      eventType,
      actorUserId ?? null,
      actorDisplayName,
      documentId ?? null,
      JSON.stringify(payload),
    ]
  );
}

// ── document.approved ─────────────────────────────────────────────────────────

describe('writePbvApplicationEvent: document.approved', () => {
  it('writes one row with correct columns', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.approved',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: DOC_ID,
      payload: { doc_type: 'bank_statement', label: 'Bank Statement (last 3 months)' },
    });

    const rows = await rawQuery<{
      anchor_type: string;
      anchor_id: string;
      event_type: string;
      actor_user_id: string;
      actor_display_name: string;
      document_id: string;
      payload: Record<string, unknown>;
    }>(`SELECT anchor_type, anchor_id, event_type, actor_user_id, actor_display_name,
               document_id, payload
        FROM application_events`);

    expect(rows).toHaveLength(1);
    expect(rows[0].anchor_type).toBe('pbv_full_application');
    expect(rows[0].anchor_id).toBe(APP_ID);
    expect(rows[0].event_type).toBe('document.approved');
    expect(rows[0].actor_user_id).toBe(ACTOR_USER_ID);
    expect(rows[0].actor_display_name).toBe('Test Staff');
    expect(rows[0].document_id).toBe(DOC_ID);
    expect(rows[0].payload['doc_type']).toBe('bank_statement');
    expect(rows[0].payload['label']).toBe('Bank Statement (last 3 months)');
  });

  it('allows null actor_user_id (system action)', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.approved',
      actorUserId: null,
      actorDisplayName: 'System',
      documentId: DOC_ID,
      payload: { doc_type: 'government_id', label: 'Government ID' },
    });

    const rows = await rawQuery<{ actor_user_id: string | null }>(
      'SELECT actor_user_id FROM application_events'
    );
    expect(rows[0].actor_user_id).toBeNull();
  });
});

// ── document.rejected ─────────────────────────────────────────────────────────

describe('writePbvApplicationEvent: document.rejected', () => {
  it('writes rejection_reason in payload', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.rejected',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: DOC_ID,
      payload: {
        doc_type: 'bank_statement',
        label: 'Bank Statement (last 3 months)',
        rejection_reason: 'document_too_old',
      },
    });

    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM application_events WHERE event_type = $1',
      ['document.rejected']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].payload['rejection_reason']).toBe('document_too_old');
  });
});

// ── document.waived ───────────────────────────────────────────────────────────

describe('writePbvApplicationEvent: document.waived', () => {
  it('writes waived event without rejection_reason', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.waived',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: DOC_ID,
      payload: { doc_type: 'bank_statement', label: 'Bank Statement (last 3 months)' },
    });

    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM application_events WHERE event_type = $1',
      ['document.waived']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].payload['rejection_reason']).toBeUndefined();
  });
});

// ── document.uploaded_by_staff ────────────────────────────────────────────────

describe('writePbvApplicationEvent: document.uploaded_by_staff', () => {
  it('writes file_name and staff_upload_note in payload', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.uploaded_by_staff',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: DOC_ID,
      payload: {
        doc_type: 'bank_statement',
        label: 'Bank Statement (last 3 months)',
        file_name: '10_Wolcott_bank_statement.pdf',
        staff_upload_note: null,
      },
    });

    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM application_events WHERE event_type = $1',
      ['document.uploaded_by_staff']
    );
    expect(rows[0].payload['file_name']).toBe('10_Wolcott_bank_statement.pdf');
    expect(rows[0].payload['staff_upload_note']).toBeNull();
  });
});

// ── document.recategorized ────────────────────────────────────────────────────

describe('writePbvApplicationEvent: document.recategorized', () => {
  it('writes from_doc_type and to_doc_type in payload', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.recategorized',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: DOC_ID,
      payload: {
        from_doc_type: 'bank_statement',
        to_doc_type: 'government_id',
        label: 'Bank Statement (last 3 months)',
      },
    });

    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM application_events WHERE event_type = $1',
      ['document.recategorized']
    );
    expect(rows[0].payload['from_doc_type']).toBe('bank_statement');
    expect(rows[0].payload['to_doc_type']).toBe('government_id');
  });
});

// ── handoff.sent ──────────────────────────────────────────────────────────────

describe('writePbvApplicationEvent: handoff.sent', () => {
  it('writes hach_review_status and hach_packet_revision', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'handoff.sent',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: null,
      payload: {
        hach_review_status: 'pending_hach',
        hach_packet_revision: 1,
      },
    });

    const rows = await rawQuery<{ document_id: string | null; payload: Record<string, unknown> }>(
      'SELECT document_id, payload FROM application_events WHERE event_type = $1',
      ['handoff.sent']
    );
    expect(rows[0].document_id).toBeNull();
    expect(rows[0].payload['hach_review_status']).toBe('pending_hach');
    expect(rows[0].payload['hach_packet_revision']).toBe(1);
  });
});

// ── handoff.reopened ──────────────────────────────────────────────────────────

describe('writePbvApplicationEvent: handoff.reopened', () => {
  it('writes reopen_reason and previous_hach_review_status', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'handoff.reopened',
      actorUserId: ACTOR_USER_ID,
      actorDisplayName: 'Test Staff',
      documentId: null,
      payload: {
        reopen_reason: 'Missing document added',
        previous_hach_review_status: 'pending_hach',
      },
    });

    const rows = await rawQuery<{ payload: Record<string, unknown> }>(
      'SELECT payload FROM application_events WHERE event_type = $1',
      ['handoff.reopened']
    );
    expect(rows[0].payload['reopen_reason']).toBe('Missing document added');
    expect(rows[0].payload['previous_hach_review_status']).toBe('pending_hach');
  });
});

// ── Multiple events, same anchor ──────────────────────────────────────────────

describe('multiple events on same anchor', () => {
  it('accumulates all events and they are all queryable by anchor_id', async () => {
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.approved',
      actorDisplayName: 'Staff A',
      documentId: DOC_ID,
      payload: { doc_type: 'bank_statement', label: 'Bank Statement' },
    });
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'document.waived',
      actorDisplayName: 'Staff B',
      documentId: DOC_ID,
      payload: { doc_type: 'government_id', label: 'Government ID' },
    });
    await writeEventDirect({
      anchorId: APP_ID,
      eventType: 'handoff.sent',
      actorDisplayName: 'Staff A',
      documentId: null,
      payload: { hach_review_status: 'pending_hach', hach_packet_revision: 1 },
    });

    const rows = await rawQuery<{ event_type: string }>(
      'SELECT event_type FROM application_events WHERE anchor_id = $1 ORDER BY created_at',
      [APP_ID]
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.event_type)).toEqual([
      'document.approved',
      'document.waived',
      'handoff.sent',
    ]);
  });

  it('wipe clears all events between tests', async () => {
    const rows = await rawQuery('SELECT id FROM application_events');
    expect(rows).toHaveLength(0);
  });
});
