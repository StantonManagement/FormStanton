-- When a pbv_full_applications row is deleted (directly, or via the
-- pre-application ON DELETE CASCADE from 20260601000000), its FK-linked children
-- cascade automatically. But several tables are linked POLYMORPHICALLY via
-- (anchor_type, anchor_id) rather than a real foreign key, so the DB cascade
-- can't reach them and they orphan:
--   * application_documents  (anchor_type='pbv_full_application')
--   * application_events      (anchor_type='pbv_full_application')
--   * intake_batches          (anchor_type='pbv_full_application')
--   * review_workspaces       (anchor_id = the application id; no anchor_type col)
--
-- This BEFORE DELETE trigger removes those rows for the application being
-- deleted. It fires for BOTH a direct delete and a pre-app cascade delete, so
-- the orphan gap is closed in one place.
--
-- Ordering note: application_documents is referenced by
-- pbv_signature_audit_log.document_id (ON DELETE NO ACTION). Those audit rows
-- are tied to the same application and would be cascade-removed when the app
-- row itself is deleted (application_id ON DELETE CASCADE) — but that happens
-- AFTER this BEFORE trigger. So we delete the signature audit log up front to
-- avoid the NO ACTION reference blocking the application_documents delete.
--
-- Deleting application_documents cascades application_document_revisions and
-- document_review_actions(document_id). review_workspaces / intake_batches
-- cascade their own children (workspace_*, intake_pages).
--
-- NOTE: generated PDF / uploaded document objects in Supabase Storage are NOT
-- removed by this trigger and will orphan in the bucket.

CREATE OR REPLACE FUNCTION public.pbv_full_app_delete_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove audit rows first so their NO ACTION document_id FK to
  -- application_documents does not block the delete below.
  DELETE FROM public.pbv_signature_audit_log WHERE application_id = OLD.id;

  DELETE FROM public.application_documents
    WHERE anchor_type = 'pbv_full_application' AND anchor_id = OLD.id;

  DELETE FROM public.application_events
    WHERE anchor_type = 'pbv_full_application' AND anchor_id = OLD.id;

  DELETE FROM public.intake_batches
    WHERE anchor_type = 'pbv_full_application' AND anchor_id = OLD.id;

  DELETE FROM public.review_workspaces WHERE anchor_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_pbv_full_app_delete_cleanup ON public.pbv_full_applications;
CREATE TRIGGER trg_pbv_full_app_delete_cleanup
  BEFORE DELETE ON public.pbv_full_applications
  FOR EACH ROW EXECUTE FUNCTION public.pbv_full_app_delete_cleanup();
