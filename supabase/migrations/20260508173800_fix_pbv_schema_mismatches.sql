-- Fix PBV schema mismatches found during invite flow audit
--
-- 1. form_submissions.form_data: add default so admin invitation inserts don't need to
--    provide form_data upfront (it gets populated at tenant intake time)
-- 2. form_submission_documents: add requires_signature + signer_scope (code inserts/selects these)
-- 3. form_document_templates: add requires_signature + signer_scope (code reads these from templates)

ALTER TABLE public.form_submissions
  ALTER COLUMN form_data SET DEFAULT '{}'::jsonb;

ALTER TABLE public.form_submission_documents
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signer_scope TEXT;

ALTER TABLE public.form_document_templates
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signer_scope TEXT;
