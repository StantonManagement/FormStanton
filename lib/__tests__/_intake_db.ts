/**
 * PGlite-backed test harness for packet intake substrate save-path tests.
 *
 * DESIGN
 * ------
 * Covers exactly two real tables scoped to intake: intake_batches, intake_pages.
 * doc_type_signatures is read-only at runtime (loaded by classifier) — not written
 * by save-path tests — so it is a stub here.
 *
 * Follows docs/verification-methodology_2026-05-13.md:
 *   - No mocks. rawQuery only.
 *   - Schema hand-maintained against prod.
 *   - Stubs exist only to satisfy FK references.
 *   - RLS, TRIGGERs stripped (PGlite does not enforce them).
 *
 * DRIFT DETECTION
 * ---------------
 * Add intake_batches and intake_pages to scripts/check-pbv-test-schema-drift.ts
 * (or create scripts/check-intake-test-schema-drift.ts) before next release.
 */

import { PGlite } from '@electric-sql/pglite';

export const INTAKE_MINIMAL_SCHEMA = `

-- ===== STUB TABLES =====

CREATE TABLE IF NOT EXISTS auth_users_stub (id UUID PRIMARY KEY);

-- ===== intake_batches =====
-- Source: supabase/migrations/20260515040000_packet_intake_substrate.sql
-- RLS and TRIGGER stripped.

CREATE TABLE intake_batches (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anchor_type              TEXT        NOT NULL CHECK (anchor_type = 'pbv_full_application'),
  anchor_id                UUID        NOT NULL,
  status                   TEXT        NOT NULL DEFAULT 'uploading'
                             CHECK (status IN ('uploading','classifying','committing','committed','abandoned')),
  source_label             TEXT,
  total_pages              INTEGER,
  committed_at             TIMESTAMPTZ,
  committed_document_count INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               TEXT,
  created_by_user_id       UUID
);

CREATE INDEX idx_intake_batches_anchor
  ON intake_batches (anchor_type, anchor_id, created_at DESC);

CREATE INDEX idx_intake_batches_status
  ON intake_batches (status);

-- ===== intake_pages =====

CREATE TABLE intake_pages (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id              UUID        NOT NULL REFERENCES intake_batches(id) ON DELETE CASCADE,
  source_file_name      TEXT,
  page_index            INTEGER     NOT NULL,
  global_index          INTEGER     NOT NULL,
  image_path            TEXT,
  extracted_text        TEXT,
  ocr_confidence        TEXT        CHECK (ocr_confidence IS NULL OR ocr_confidence IN ('high','medium','low','none')),
  suggested_doc_type    TEXT,
  suggested_person_slot INTEGER,
  suggested_score       DOUBLE PRECISION,
  staged_assignment     JSONB,
  committed_document_id UUID,
  storage_move_failed   BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            TEXT
);

CREATE INDEX idx_intake_pages_batch
  ON intake_pages (batch_id, global_index);

CREATE INDEX idx_intake_pages_committed_document
  ON intake_pages (committed_document_id)
  WHERE committed_document_id IS NOT NULL;

`;

let _db: PGlite | null = null;

export async function setupIntakeTestDb(): Promise<PGlite> {
  _db = new PGlite();
  await _db.exec(INTAKE_MINIMAL_SCHEMA);
  return _db;
}

export async function rawIntakeQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!_db) throw new Error('Intake test DB not initialised — call setupIntakeTestDb() in beforeAll');
  const result = await _db.query<T>(sql, params);
  return result.rows;
}

export async function wipeIntakeTestData(tables: string[]): Promise<void> {
  if (!_db) throw new Error('Intake test DB not initialised — call setupIntakeTestDb() in beforeAll');
  for (const table of tables) {
    await _db.exec(`DELETE FROM ${table}`);
  }
}

export async function teardownIntakeTestDb(): Promise<void> {
  if (_db) {
    await _db.close();
    _db = null;
  }
}
