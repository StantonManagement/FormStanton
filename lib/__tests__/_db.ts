/**
 * PGlite-backed integration test harness for PBV save-path tests.
 *
 * DESIGN
 * ------
 * `MINIMAL_SCHEMA` is a hand-maintained SQL string covering exactly two real
 * tables (pbv_full_applications, application_events) and three stub tables
 * that exist only to satisfy FK references. It is NOT a loader; it does NOT
 * read from supabase/migrations/.
 *
 * Keeping the schema hand-maintained is intentional: the harness is scoped to
 * PBV save-path tests only. Other workflows add their own test helpers if and
 * when they add save-path tests. See docs/verification-methodology_2026-05-13.md.
 *
 * DRIFT DETECTION
 * ---------------
 * Run `npx tsx scripts/check-pbv-test-schema-drift.ts` to verify that
 * MINIMAL_SCHEMA matches production for pbv_full_applications and
 * application_events. Any column/constraint mismatch prints a diff and
 * exits non-zero. Run this before every release.
 *
 * USAGE
 * -----
 * import { setupTestDb, teardownTestDb, wipeTestData, rawQuery } from './_db';
 *
 * beforeAll(async () => { await setupTestDb(); });
 * afterAll(async () => { await teardownTestDb(); });
 * beforeEach(async () => { await wipeTestData(['application_events', ...]); });
 */

import { PGlite } from '@electric-sql/pglite';

// -----------------------------------------------------------------------------
// MINIMAL_SCHEMA
//
// Sources:
//   pbv_full_applications  ? 20260423210000_pbv_full_application_tables.sql
//                            + subsequent ALTER TABLE migrations
//   application_events     ? 20260513160000_document_lifecycle_phase1.sql (lines 52-65)
//                            + 20260513200000_application_events_generalize.sql
//
// Rules applied vs. source migrations:
//   - ENABLE ROW LEVEL SECURITY stripped (PGlite does not enforce RLS)
//   - CREATE POLICY stripped (same)
//   - CREATE TRIGGER stripped (not needed for insert/select tests)
//   - FK from pbv_full_applications.preapp_id dropped (pbv_preapplications not stubbed)
//   - FK from application_events.anchor_id dropped (polymorphic — no FK in production either)
//   - Stub tables created before real tables to satisfy remaining FK references
// -----------------------------------------------------------------------------

export const MINIMAL_SCHEMA = `

-- ===== STUB TABLES (test-only, not real schema) =====
-- These exist only to satisfy FK references from the two real tables.
-- They intentionally have only a primary key column.
-- Do NOT add these to the drift check.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);

-- form_submissions: stub includes all columns tests INSERT
CREATE TABLE IF NOT EXISTS form_submissions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT,
  form_data JSONB
);

-- form_submission_documents: stub includes columns tests INSERT
CREATE TABLE IF NOT EXISTS form_submission_documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_submission_id UUID,
  doc_type           TEXT,
  label              TEXT
);

-- form_submission_document_revisions: stub for wipe-order in harness-smoke
CREATE TABLE IF NOT EXISTS form_submission_document_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- ===== END STUBS =====


-- ===== pbv_full_applications =====
-- Source: 20260423210000_pbv_full_application_tables.sql
-- Plus columns added by later ALTER TABLE migrations:
--   intake_submitted_at, hach_review_status, stage, stage_changed_at,
--   last_activity_at, assigned_to, phone, preferred_language,
--   language_confirmed_at (from workforce/handoff migrations)
--   submitted_to_hach_at, submitted_to_hach_by, hach_packet_revision,
--   packet_locked (from 20260513161000_document_lifecycle_phase2_handoff.sql)
--   lead_user_id, lead_assigned_at, lead_assigned_by (from workforce migrations)
--   target_move_in_date (from 20260513190000_workforce_dashboards.sql)
-- RLS, TRIGGER, and COMMENT stripped.

-- NOTE: NOT NULL constraints on non-PK, non-FK columns are RELAXED here.
-- pbv_full_applications serves as an FK anchor for application_events in these
-- tests. Tests seed it with minimal columns. The drift check (scripts/check-pbv-test-schema-drift.ts)
-- catches actual schema divergence against production on the columns that matter.
CREATE TABLE pbv_full_applications (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  preapp_id                         UUID        NULL,
  form_submission_id                UUID        NOT NULL REFERENCES form_submissions(id),
  building_address                  TEXT,
  unit_number                       TEXT,
  head_of_household_name            TEXT,
  household_size                    INTEGER,
  bedroom_count                     INTEGER,
  total_annual_income               NUMERIC(10,2),
  dv_status                         BOOLEAN     NOT NULL DEFAULT FALSE,
  homeless_at_admission             BOOLEAN     NOT NULL DEFAULT FALSE,
  claiming_medical_deduction        BOOLEAN     NOT NULL DEFAULT FALSE,
  has_childcare_expense             BOOLEAN     NOT NULL DEFAULT FALSE,
  reasonable_accommodation_requested BOOLEAN   NOT NULL DEFAULT FALSE,
  stanton_review_status             TEXT        NOT NULL DEFAULT 'pending'
    CHECK (stanton_review_status IN ('pending', 'under_review', 'approved', 'denied', 'needs_info')),
  stanton_reviewer                  TEXT,
  stanton_review_date               TIMESTAMPTZ,
  stanton_review_notes              TEXT,
  hha_application_file              TEXT,
  summary_pdf_file                  TEXT,
  tenant_access_token               TEXT        UNIQUE,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                        TEXT,
  intake_submitted_at               TIMESTAMPTZ,
  hach_review_status                TEXT,
  stage                             TEXT,
  stage_changed_at                  TIMESTAMPTZ,
  last_activity_at                  TIMESTAMPTZ,
  assigned_to                       UUID,
  phone                             TEXT,
  preferred_language                TEXT,
  language_confirmed_at             TIMESTAMPTZ,
  submitted_to_hach_at              TIMESTAMPTZ,
  submitted_to_hach_by              UUID,
  hach_packet_revision              INTEGER     NOT NULL DEFAULT 0,
  packet_locked                     BOOLEAN     NOT NULL DEFAULT FALSE,
  lead_user_id                      UUID,
  lead_assigned_at                  TIMESTAMPTZ,
  lead_assigned_by                  UUID,
  target_move_in_date               DATE
);

CREATE UNIQUE INDEX idx_pbv_full_applications_token
  ON pbv_full_applications (tenant_access_token)
  WHERE tenant_access_token IS NOT NULL;

CREATE INDEX idx_pbv_full_applications_preapp
  ON pbv_full_applications (preapp_id);

CREATE INDEX idx_pbv_full_applications_form_submission
  ON pbv_full_applications (form_submission_id);

CREATE INDEX idx_pbv_full_applications_building
  ON pbv_full_applications (building_address, unit_number);

-- ===== END pbv_full_applications =====


-- ===== application_events =====
-- Source: 20260513160000_document_lifecycle_phase1.sql lines 52-65
-- Post-generalize shape from 20260513200000_application_events_generalize.sql:
--   full_application_id column dropped
--   anchor_type TEXT NOT NULL + CHECK added
--   anchor_id UUID NOT NULL added
--   idx_application_events_anchor replaces idx_application_events_app
-- RLS, POLICY stripped. No FK on anchor_id (polymorphic by design).

CREATE TABLE application_events (
  id                 UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anchor_type        TEXT        NOT NULL CHECK (anchor_type IN ('pbv_full_application')),
  anchor_id          UUID        NOT NULL,
  event_type         TEXT        NOT NULL,
  actor_user_id      TEXT        NULL,
  actor_display_name TEXT        NOT NULL,
  document_id        UUID        NULL REFERENCES form_submission_documents(id) ON DELETE SET NULL,
  payload            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by         TEXT        NULL
);

CREATE INDEX idx_application_events_anchor
  ON application_events (anchor_type, anchor_id, created_at DESC);

CREATE INDEX idx_application_events_document
  ON application_events (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

CREATE INDEX idx_application_events_type
  ON application_events (event_type, created_at DESC);

-- ===== END application_events =====
`;

// -----------------------------------------------------------------------------
// Harness internals
// -----------------------------------------------------------------------------

let _db: PGlite | null = null;

/**
 * Boots a fresh in-memory PGlite instance and applies MINIMAL_SCHEMA.
 * Call once in beforeAll. No arguments — schema is always the hand-maintained
 * constant above.
 */
export async function setupTestDb(): Promise<PGlite> {
  _db = new PGlite();
  await _db.exec(MINIMAL_SCHEMA);
  return _db;
}

/**
 * Executes a raw SQL query with optional positional parameters ($1, $2, ...).
 * Throws on DB errors — does NOT swallow them.
 */
export async function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!_db) throw new Error('Test DB not initialised — call setupTestDb() in beforeAll');
  const result = await _db.query<T>(sql, params);
  return result.rows;
}

/**
 * Deletes all rows from the given tables in the order specified.
 * Pass tables in dependency-safe order (children before parents).
 */
export async function wipeTestData(tables: string[]): Promise<void> {
  if (!_db) throw new Error('Test DB not initialised — call setupTestDb() in beforeAll');
  for (const table of tables) {
    await _db.exec(`DELETE FROM ${table}`);
  }
}

/**
 * Shuts down the PGlite instance. Call in afterAll.
 */
export async function teardownTestDb(): Promise<void> {
  if (_db) {
    await _db.close();
    _db = null;
  }
}

/**
 * Returns the raw PGlite instance for cases where rawQuery is not enough.
 * Prefer rawQuery for all test assertions.
 */
export function getDb(): PGlite {
  if (!_db) throw new Error('Test DB not initialised — call setupTestDb() in beforeAll');
  return _db;
}
