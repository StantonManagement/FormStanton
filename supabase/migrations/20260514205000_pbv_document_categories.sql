-- PRD-14 Phase 4: add category column to form_document_templates and application_documents
-- and backfill from the existing display_order ranges in the PBV templates seed.

ALTER TABLE public.form_document_templates ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.application_documents   ADD COLUMN IF NOT EXISTS category TEXT;

-- Backfill templates (form_id-scoped — does not touch templates for other forms)
UPDATE public.form_document_templates SET category = CASE
  WHEN display_order <  110 THEN 'income'
  WHEN display_order <  200 THEN 'assets'
  WHEN display_order <  300 THEN 'medical_childcare'
  WHEN display_order <  400 THEN 'immigration'
  ELSE                            'signed_forms'
END
WHERE form_id = 'pbv-full-application' AND category IS NULL;

-- Backfill application_documents by joining to its template
UPDATE public.application_documents ad
SET category = t.category
FROM public.form_document_templates t
WHERE ad.anchor_type = 'pbv_full_application'
  AND ad.category IS NULL
  AND t.form_id   = 'pbv-full-application'
  AND t.doc_type  = ad.doc_type;

-- Lock the templates column. Application docs stay nullable for custom admin-added docs.
ALTER TABLE public.form_document_templates ALTER COLUMN category SET NOT NULL;

-- Optional: index for grouping query patterns (tenant + admin both group by category)
CREATE INDEX IF NOT EXISTS idx_application_documents_anchor_category
  ON public.application_documents (anchor_type, anchor_id, category, display_order, person_slot);
