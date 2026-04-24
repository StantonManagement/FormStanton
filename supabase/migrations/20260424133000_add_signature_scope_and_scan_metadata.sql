-- Add signature metadata and scan quality metadata for PBV tenant flow

ALTER TABLE public.form_document_templates
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signer_scope TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fdt_signer_scope_chk'
      AND conrelid = 'public.form_document_templates'::regclass
  ) THEN
    ALTER TABLE public.form_document_templates
      ADD CONSTRAINT fdt_signer_scope_chk
      CHECK (signer_scope IS NULL OR signer_scope IN ('all_adults', 'hoh_only', 'individual'));
  END IF;
END
$$;

ALTER TABLE public.form_submission_documents
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signer_scope TEXT,
  ADD COLUMN IF NOT EXISTS scan_metadata JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fsd_signer_scope_chk'
      AND conrelid = 'public.form_submission_documents'::regclass
  ) THEN
    ALTER TABLE public.form_submission_documents
      ADD CONSTRAINT fsd_signer_scope_chk
      CHECK (signer_scope IS NULL OR signer_scope IN ('all_adults', 'hoh_only', 'individual'));
  END IF;
END
$$;

UPDATE public.form_document_templates
SET
  requires_signature = TRUE,
  signer_scope = CASE
    WHEN doc_type IN (
      'main_application',
      'criminal_background_release',
      'hud_9886a',
      'hach_release',
      'debts_owed_phas',
      'citizenship_declaration'
    ) THEN 'all_adults'
    WHEN doc_type IN (
      'obligations_of_family',
      'briefing_docs_certification',
      'hud_92006',
      'eiv_guide_receipt'
    ) THEN 'hoh_only'
    WHEN doc_type IN (
      'child_support_affidavit',
      'no_child_support_affidavit',
      'vawa_certification',
      'reasonable_accommodation_request'
    ) THEN 'individual'
    ELSE signer_scope
  END,
  per_person = CASE
    WHEN doc_type IN ('obligations_of_family', 'briefing_docs_certification', 'hud_92006', 'eiv_guide_receipt') THEN FALSE
    WHEN doc_type = 'child_support_affidavit' THEN TRUE
    ELSE per_person
  END,
  applies_to = CASE
    WHEN doc_type IN ('obligations_of_family', 'briefing_docs_certification', 'hud_92006', 'eiv_guide_receipt') THEN 'submission'
    WHEN doc_type = 'child_support_affidavit' THEN 'each_member_matching_rule'
    ELSE applies_to
  END,
  member_filter = CASE
    WHEN doc_type = 'child_support_affidavit' THEN '{"field": "has_child_support", "value": true}'::jsonb
    WHEN doc_type IN ('obligations_of_family', 'briefing_docs_certification', 'hud_92006', 'eiv_guide_receipt') THEN NULL
    ELSE member_filter
  END
WHERE form_id = 'pbv-full-application'
  AND doc_type IN (
    'main_application',
    'criminal_background_release',
    'child_support_affidavit',
    'hud_9886a',
    'hach_release',
    'obligations_of_family',
    'briefing_docs_certification',
    'debts_owed_phas',
    'citizenship_declaration',
    'hud_92006',
    'eiv_guide_receipt',
    'vawa_certification',
    'reasonable_accommodation_request',
    'no_child_support_affidavit'
  );

INSERT INTO public.form_document_templates (
  form_id,
  doc_type,
  label,
  label_es,
  label_pt,
  required,
  conditional_on,
  display_order,
  per_person,
  applies_to,
  member_filter,
  requires_signature,
  signer_scope,
  created_by
)
VALUES (
  'pbv-full-application',
  'no_child_support_affidavit',
  'No Child Support Affidavit',
  'Declaración jurada de no manutención infantil',
  'Declaração de ausência de pensão alimentícia',
  TRUE,
  '{"any_member_has_child_support": false}'::jsonb,
  425,
  FALSE,
  'submission',
  NULL,
  TRUE,
  'individual',
  'system'
)
ON CONFLICT (form_id, doc_type) DO UPDATE SET
  label = EXCLUDED.label,
  label_es = EXCLUDED.label_es,
  label_pt = EXCLUDED.label_pt,
  required = EXCLUDED.required,
  conditional_on = EXCLUDED.conditional_on,
  display_order = EXCLUDED.display_order,
  per_person = EXCLUDED.per_person,
  applies_to = EXCLUDED.applies_to,
  member_filter = EXCLUDED.member_filter,
  requires_signature = EXCLUDED.requires_signature,
  signer_scope = EXCLUDED.signer_scope;
