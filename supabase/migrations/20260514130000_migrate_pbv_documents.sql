-- =============================================================================
-- PBV Documents Migration — form_submission_documents → application_documents
--
-- What this does:
--   1. Adds migrated_to_application_documents_id to form_submission_documents
--   2. Creates _migration_pbv_documents_map tracking table
--   3. Copies all PBV documents to application_documents
--   4. Records old→new ID map in both tracking structures
--   5. Drops the FK constraint on application_events.document_id
--      (retargets to soft reference, matching the polymorphic pattern)
--   6. Backfills application_events.document_id for PBV-anchored events
--
-- Idempotent: re-running makes zero changes (already-migrated rows are skipped).
-- Transactional: 34 PBV rows — single transaction, no chunking needed.
--
-- ROLLBACK: run scripts/rollback-pbv-documents-migration.sql
-- =============================================================================

BEGIN;

-- ─── Step 1: Add migration marker column to form_submission_documents ─────────

ALTER TABLE public.form_submission_documents
  ADD COLUMN IF NOT EXISTS migrated_to_application_documents_id UUID NULL;


-- ─── Step 2: Create transient map table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public._migration_pbv_documents_map (
  old_id      UUID        PRIMARY KEY,
  new_id      UUID        NOT NULL UNIQUE,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─── Step 3: Copy PBV documents to application_documents ─────────────────────
-- Only rows not yet migrated (migrated_to_application_documents_id IS NULL)

INSERT INTO public.application_documents (
  anchor_type,
  anchor_id,
  doc_type,
  label,
  required,
  display_order,
  person_slot,
  revision,
  status,
  file_name,
  storage_path,
  requires_signature,
  signer_scope,
  original_doc_type,
  uploaded_by_role,
  uploaded_by_user_id,
  uploaded_by_display_name,
  staff_upload_note,
  reviewer,
  reviewed_at,
  rejection_reason,
  notes,
  assigned_to_user_id,
  assigned_at,
  assigned_by_user_id,
  owner_review_status,
  owner_reviewed_at,
  owner_reviewed_by,
  owner_flag_reason,
  created_at,
  updated_at,
  created_by
)
SELECT
  'pbv_full_application'                AS anchor_type,
  pfa.id                                AS anchor_id,
  fsd.doc_type,
  fsd.label,
  fsd.required,
  fsd.display_order,
  fsd.person_slot,
  fsd.revision,
  fsd.status,
  fsd.file_name,
  fsd.storage_path,
  fsd.requires_signature,
  fsd.signer_scope,
  fsd.original_doc_type,
  fsd.uploaded_by_role,
  fsd.uploaded_by_user_id,
  fsd.uploaded_by_display_name,
  fsd.staff_upload_note,
  fsd.reviewer,
  fsd.reviewed_at,
  fsd.rejection_reason,
  fsd.notes,
  fsd.assigned_to_user_id,
  fsd.assigned_at,
  fsd.assigned_by_user_id,
  fsd.owner_review_status,
  fsd.owner_reviewed_at,
  fsd.owner_reviewed_by,
  fsd.owner_flag_reason,
  fsd.created_at,
  fsd.updated_at,
  fsd.created_by
FROM public.form_submission_documents fsd
JOIN public.form_submissions fs ON fs.id = fsd.form_submission_id
JOIN public.pbv_full_applications pfa ON pfa.form_submission_id = fs.id
WHERE fsd.migrated_to_application_documents_id IS NULL;


-- ─── Step 4: Record the old→new ID map ───────────────────────────────────────

INSERT INTO public._migration_pbv_documents_map (old_id, new_id)
SELECT
  fsd.id                   AS old_id,
  ad.id                    AS new_id
FROM public.form_submission_documents fsd
JOIN public.form_submissions fs ON fs.id = fsd.form_submission_id
JOIN public.pbv_full_applications pfa ON pfa.form_submission_id = fs.id
JOIN public.application_documents ad
  ON ad.anchor_type = 'pbv_full_application'
  AND ad.anchor_id = pfa.id
  AND ad.doc_type = fsd.doc_type
  AND ad.person_slot = fsd.person_slot
  AND ad.revision = fsd.revision
WHERE fsd.migrated_to_application_documents_id IS NULL
ON CONFLICT (old_id) DO NOTHING;


-- ─── Step 5: Stamp migration marker on source rows ───────────────────────────

UPDATE public.form_submission_documents fsd
SET migrated_to_application_documents_id = m.new_id
FROM public._migration_pbv_documents_map m
WHERE m.old_id = fsd.id
  AND fsd.migrated_to_application_documents_id IS NULL;


-- ─── Step 6: Drop FK on application_events.document_id ───────────────────────
-- Retargets to soft reference matching the polymorphic anchor pattern.

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.application_events'::regclass
    AND contype = 'f'
    AND conname ILIKE '%document_id%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.application_events DROP CONSTRAINT %I', fk_name);
  END IF;
END;
$$;


-- ─── Step 7: Backfill application_events.document_id for PBV-anchored events ─

UPDATE public.application_events ae
SET document_id = m.new_id
FROM public._migration_pbv_documents_map m
WHERE ae.document_id = m.old_id
  AND ae.anchor_type = 'pbv_full_application';


-- ─── Step 8: Assert — all PBV event document_ids resolve to application_documents ──

DO $$
DECLARE
  unresolved INTEGER;
BEGIN
  SELECT COUNT(*) INTO unresolved
  FROM public.application_events ae
  WHERE ae.anchor_type = 'pbv_full_application'
    AND ae.document_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.application_documents ad WHERE ad.id = ae.document_id
    );

  IF unresolved > 0 THEN
    RAISE EXCEPTION
      'Migration incomplete: % application_events rows have document_id not in application_documents',
      unresolved;
  END IF;
END;
$$;


COMMIT;
