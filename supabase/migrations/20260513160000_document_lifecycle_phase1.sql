-- =============================================================================
-- Document Lifecycle Phase 1
-- Adds:
--   1. form_submission_document_revisions  — append-only revision history table
--   2. application_events                  — typed event log for full applications
--   3. Provenance columns on form_submission_documents
-- =============================================================================


-- ─── 1. form_submission_document_revisions ────────────────────────────────────

CREATE TABLE IF NOT EXISTS form_submission_document_revisions (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id       UUID        NOT NULL REFERENCES form_submission_documents(id) ON DELETE CASCADE,
  revision          INTEGER     NOT NULL,
  file_name         TEXT        NOT NULL,
  storage_path      TEXT        NOT NULL,
  uploaded_by       TEXT        NOT NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_at_review  TEXT        CHECK (status_at_review IN ('approved','rejected','waived')) NULL,
  rejection_reason  TEXT        NULL,
  reviewer          TEXT        NULL,
  reviewed_at       TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        TEXT        NULL,
  UNIQUE (document_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_fsdr_document
  ON form_submission_document_revisions (document_id);

CREATE INDEX IF NOT EXISTS idx_fsdr_document_revision
  ON form_submission_document_revisions (document_id, revision);

CREATE TRIGGER set_form_submission_document_revisions_updated_at
  BEFORE UPDATE ON form_submission_document_revisions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE form_submission_document_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on form_submission_document_revisions"
  ON form_submission_document_revisions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 2. application_events ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS application_events (
  id                   UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_application_id  UUID        NOT NULL REFERENCES pbv_full_applications(id) ON DELETE CASCADE,
  event_type           TEXT        NOT NULL,
  actor_user_id        TEXT        NULL,
  actor_display_name   TEXT        NOT NULL,
  document_id          UUID        NULL REFERENCES form_submission_documents(id) ON DELETE SET NULL,
  payload              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by           TEXT        NULL
);

CREATE INDEX IF NOT EXISTS idx_application_events_app
  ON application_events (full_application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_application_events_document
  ON application_events (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_application_events_type
  ON application_events (event_type, created_at DESC);

ALTER TABLE application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on application_events"
  ON application_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ─── 3. Provenance columns on form_submission_documents ──────────────────────

ALTER TABLE form_submission_documents
  ADD COLUMN IF NOT EXISTS uploaded_by_role          TEXT NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id       TEXT NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by_display_name  TEXT NULL,
  ADD COLUMN IF NOT EXISTS staff_upload_note         TEXT NULL,
  ADD COLUMN IF NOT EXISTS original_doc_type         TEXT NULL;
