-- Fix: pbv_signature_events.form_document_id must be NULLABLE.
--
-- The application *summary* signature (POST /api/t/[token]/pbv-full-app/sign-summary)
-- is not tied to a specific federal form, so the route inserts
-- form_document_id = NULL. The original table definition
-- (20260515020000_pbv_signature_events.sql) declared the column NOT NULL, so
-- every summary-signature insert failed with Postgres 23502
-- ("null value in column \"form_document_id\" ... violates not-null constraint")
-- and summary signing could never complete on a fresh application.
--
-- Form signatures continue to set a non-null form_document_id, so the FK to
-- pbv_form_documents and the (form_document_id, signer_member_id) uniqueness
-- still apply to form signatures. Summary rows (NULL form_document_id) are
-- exempt from the unique constraint under Postgres' default NULLS-DISTINCT
-- semantics, which is the intended behavior (one summary signature per
-- application is enforced at the application layer via pbv_summary_documents).
--
-- Apply after: 20260515020000_pbv_signature_events.sql

ALTER TABLE public.pbv_signature_events
  ALTER COLUMN form_document_id DROP NOT NULL;

COMMENT ON COLUMN public.pbv_signature_events.form_document_id IS
  'FK to pbv_form_documents. NULL for the application summary signature, which '
  'is not tied to a specific federal form (see the sign-summary route).';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- Re-adding NOT NULL is only safe if no summary signatures exist (any row with
-- form_document_id IS NULL would block it):
--   ALTER TABLE public.pbv_signature_events ALTER COLUMN form_document_id SET NOT NULL;
-- ─────────────────────────────────────────────────────────────────────────────
