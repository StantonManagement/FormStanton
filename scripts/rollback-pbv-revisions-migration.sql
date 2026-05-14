-- =============================================================================
-- PBV Revisions Migration ROLLBACK
--
-- Restores prior state: clears application_document_revisions of migrated rows,
-- clears the migration marker on source rows, drops the transient map.
--
-- Run this in psql or Supabase SQL Editor if you need to reverse the migration.
-- =============================================================================

BEGIN;

-- ─── Step 1: Clear migration marker on source rows ───────────────────────────

UPDATE public.form_submission_document_revisions
SET migrated_to_application_document_revisions_id = NULL
WHERE migrated_to_application_document_revisions_id IS NOT NULL;


-- ─── Step 2: Clear migrated rows from target table ───────────────────────────

DELETE FROM public.application_document_revisions
WHERE migrated_from_form_submission_document_revisions_id IS NOT NULL;


-- ─── Step 3: Drop the transient map table ────────────────────────────────────

DROP TABLE IF EXISTS public._migration_pbv_revisions_map;


-- ─── Step 4: (Optional) Drop the migration marker column ─────────────────────
-- Uncomment if you want to fully restore the source schema:
-- ALTER TABLE public.form_submission_document_revisions
--   DROP COLUMN IF EXISTS migrated_to_application_document_revisions_id;


COMMIT;
