-- =============================================================================
-- ROLLBACK: PBV Documents Migration
--
-- Reverses 20260514130000_migrate_pbv_documents.sql.
-- Run only against a copy of the dataset or in a controlled rollback scenario.
--
-- What this does:
--   1. Restores application_events.document_id for PBV-anchored events
--      back to the original form_submission_documents.id values.
--   2. Re-adds the FK constraint on application_events.document_id.
--   3. Clears migrated_to_application_documents_id on form_submission_documents.
--   4. Truncates application_documents (PBV rows only).
--   5. Drops the _migration_pbv_documents_map table.
--
-- This is NOT idempotent by design — it assumes the forward migration has run.
-- =============================================================================

BEGIN;

-- ─── Step 1: Restore application_events.document_id to old IDs ───────────────

UPDATE public.application_events ae
SET document_id = m.old_id
FROM public._migration_pbv_documents_map m
WHERE ae.document_id = m.new_id
  AND ae.anchor_type = 'pbv_full_application';


-- ─── Step 2: Re-add FK constraint on application_events.document_id ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.application_events'::regclass
      AND conname = 'application_events_document_id_fkey'
  ) THEN
    ALTER TABLE public.application_events
      ADD CONSTRAINT application_events_document_id_fkey
        FOREIGN KEY (document_id)
        REFERENCES public.form_submission_documents(id)
        ON DELETE SET NULL;
  END IF;
END;
$$;


-- ─── Step 3: Clear migration markers on form_submission_documents ─────────────

UPDATE public.form_submission_documents
SET migrated_to_application_documents_id = NULL
WHERE migrated_to_application_documents_id IS NOT NULL;


-- ─── Step 4: Delete PBV rows from application_documents ──────────────────────
-- Deletes only rows that were created by the forward migration (tracked in map).

DELETE FROM public.application_documents
WHERE id IN (SELECT new_id FROM public._migration_pbv_documents_map);


-- ─── Step 5: Drop the map table ──────────────────────────────────────────────

DROP TABLE IF EXISTS public._migration_pbv_documents_map;


COMMIT;
