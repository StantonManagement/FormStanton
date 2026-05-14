-- =============================================================================
-- application_document_revisions — Polymorphic document revisions table
--
-- Mirrors form_submission_document_revisions structurally, replacing the anchor:
--   document_id UUID (FK to form_submission_documents)
--     → application_document_id UUID (FK to application_documents)
--
-- Structural parity: every column on the source table is mirrored verbatim.
-- The parent table (application_documents) carries the polymorphic anchor.
--
-- Idempotent — safe to re-apply (uses IF NOT EXISTS throughout).
-- =============================================================================

BEGIN;

-- ─── 1. Create application_document_revisions ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.application_document_revisions (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Anchor to parent (replaces document_id → form_submission_documents)
  application_document_id   UUID        NOT NULL,

  -- Revision identity
  revision                  INTEGER     NOT NULL,

  -- File metadata (mirrored from source)
  file_name                 TEXT        NOT NULL,
  storage_path              TEXT        NOT NULL,

  -- Provenance (mirrored from source)
  uploaded_by               TEXT        NOT NULL,
  uploaded_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Review state at time of upload (mirrored from source)
  status_at_review          TEXT        NULL,
  rejection_reason          TEXT        NULL,
  reviewer                  TEXT        NULL,
  reviewed_at               TIMESTAMPTZ NULL,

  -- Audit (mirrored from source)
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                TEXT        NULL,

  -- Migration traceability (added by this PRD)
  migrated_from_form_submission_document_revisions_id UUID NULL,

  -- Constraints
  CONSTRAINT adr_application_document_fk
    FOREIGN KEY (application_document_id)
    REFERENCES public.application_documents(id)
    ON DELETE CASCADE,

  CONSTRAINT adr_revision_unique
    UNIQUE (application_document_id, revision)
);


-- ─── 2. Indexes ───────────────────────────────────────────────────────────────

-- Primary lookup: all revisions of a document, newest first
CREATE INDEX IF NOT EXISTS idx_adr_application_document_revision
  ON public.application_document_revisions (application_document_id, revision DESC);

-- Timeline view alternative
CREATE INDEX IF NOT EXISTS idx_adr_application_document_created
  ON public.application_document_revisions (application_document_id, created_at DESC);

-- Migration validation
CREATE INDEX IF NOT EXISTS idx_adr_migrated_from
  ON public.application_document_revisions (migrated_from_form_submission_document_revisions_id)
  WHERE migrated_from_form_submission_document_revisions_id IS NOT NULL;


-- ─── 3. updated_at trigger ────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_application_document_revisions_updated_at'
    AND tgrelid = 'public.application_document_revisions'::regclass
  ) THEN
    CREATE TRIGGER set_application_document_revisions_updated_at
      BEFORE UPDATE ON public.application_document_revisions
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END;
$$;


-- ─── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.application_document_revisions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'service_role full access on application_document_revisions'
    AND tablename = 'application_document_revisions'
  ) THEN
    CREATE POLICY "service_role full access on application_document_revisions"
      ON public.application_document_revisions
      FOR ALL TO service_role
      USING (TRUE)
      WITH CHECK (TRUE);
  END IF;
END;
$$;


COMMIT;
