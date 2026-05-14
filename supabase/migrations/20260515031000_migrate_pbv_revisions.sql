-- =============================================================================
-- PBV Document Revisions Migration — form_submission_document_revisions
--                                        → application_document_revisions
--
-- What this does:
--   1. Adds migrated_to_application_document_revisions_id to source table
--   2. Creates _migration_pbv_revisions_map tracking table
--   3. Copies PBV revisions to application_document_revisions
--   4. Records old→new mapping in both tracking structures
--
-- Idempotent: re-running makes zero changes (already-migrated rows are skipped).
--
-- ROLLBACK: run scripts/rollback-pbv-revisions-migration.sql
-- =============================================================================

BEGIN;

-- ─── Step 1: Add migration marker column to source table ─────────────────────

ALTER TABLE public.form_submission_document_revisions
  ADD COLUMN IF NOT EXISTS migrated_to_application_document_revisions_id UUID NULL;


-- ─── Step 2: Create transient map table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public._migration_pbv_revisions_map (
  old_id      UUID PRIMARY KEY,
  new_id      UUID NOT NULL UNIQUE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── Step 3: Copy PBV revisions to application_document_revisions ─────────
-- Only rows not yet migrated (migrated_to_application_document_revisions_id IS NULL)
-- Join via _migration_pbv_documents_map to identify PBV docs and get new parent IDs

INSERT INTO public.application_document_revisions (
  application_document_id,
  revision,
  file_name,
  storage_path,
  uploaded_by,
  uploaded_at,
  status_at_review,
  rejection_reason,
  reviewer,
  reviewed_at,
  created_at,
  updated_at,
  created_by,
  migrated_from_form_submission_document_revisions_id
)
SELECT
  doc_map.new_id                                                      AS application_document_id,
  fsdr.revision,
  fsdr.file_name,
  fsdr.storage_path,
  fsdr.uploaded_by,
  fsdr.uploaded_at,
  fsdr.status_at_review,
  fsdr.rejection_reason,
  fsdr.reviewer,
  fsdr.reviewed_at,
  fsdr.created_at,
  fsdr.updated_at,
  fsdr.created_by,
  fsdr.id                                                              AS migrated_from_form_submission_document_revisions_id
FROM public.form_submission_document_revisions fsdr
JOIN public.form_submission_documents fsd ON fsd.id = fsdr.document_id
JOIN public._migration_pbv_documents_map doc_map ON doc_map.old_id = fsd.id
WHERE fsdr.migrated_to_application_document_revisions_id IS NULL
ON CONFLICT (application_document_id, revision) DO NOTHING;


-- ─── Step 4: Record the old→new ID map ───────────────────────────────────────

INSERT INTO public._migration_pbv_revisions_map (old_id, new_id)
SELECT
  fsdr.id                   AS old_id,
  adr.id                    AS new_id
FROM public.form_submission_document_revisions fsdr
JOIN public.form_submission_documents fsd ON fsd.id = fsdr.document_id
JOIN public._migration_pbv_documents_map doc_map ON doc_map.old_id = fsd.id
JOIN public.application_document_revisions adr
  ON adr.application_document_id = doc_map.new_id
  AND adr.revision = fsdr.revision
WHERE fsdr.migrated_to_application_document_revisions_id IS NULL
ON CONFLICT (old_id) DO NOTHING;


-- ─── Step 5: Stamp migration marker on source rows ─────────────────────────

UPDATE public.form_submission_document_revisions fsdr
SET migrated_to_application_document_revisions_id = m.new_id
FROM public._migration_pbv_revisions_map m
WHERE m.old_id = fsdr.id
  AND fsdr.migrated_to_application_document_revisions_id IS NULL;


COMMIT;
