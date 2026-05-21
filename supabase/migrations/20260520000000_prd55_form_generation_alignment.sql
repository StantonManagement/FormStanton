-- PRD-55: Form-Generation Completeness & Template Alignment
-- Date: 2026-05-20
--
-- This migration:
-- 1. Renames briefing_docs_certification → briefing_cert (canonical form_id alignment)
-- 2. Disables generation for forms missing source PDFs (pet, vehicle, self-employment)
-- 3. Disables generation for upload-only forms (criminal_background_release)
--
-- NOTE: generation_enabled is deliberately being updated here per PRD-55.
-- These forms have field maps but lack source PDFs, so they silently skip.
-- Generation will be re-enabled when PDFs are sourced.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rename briefing_docs_certification → briefing_cert
-- ─────────────────────────────────────────────────────────────────────────────

-- Update the form_id in pbv_form_templates
UPDATE public.pbv_form_templates
SET form_id = 'briefing_cert',
    notes = 'Sourced + field-mapped in PRD-22. Renamed from briefing_docs_certification in PRD-55.'
WHERE form_id = 'briefing_docs_certification';

-- Update referencing rows in pbv_form_documents (if any exist)
UPDATE public.pbv_form_documents
SET form_id = 'briefing_cert'
WHERE form_id = 'briefing_docs_certification';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Disable generation for source-pending forms
--    These have field maps but no source PDFs, causing silent skips.
--    Re-enable when PDFs are sourced.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.pbv_form_templates
SET generation_enabled = FALSE,
    notes = 'Source PDFs missing (pet-addendum-*.pdf). generation_enabled=FALSE per PRD-55. Re-enable when PDFs sourced.'
WHERE form_id = 'pet_addendum';

UPDATE public.pbv_form_templates
SET generation_enabled = FALSE,
    notes = 'Source PDFs missing (vehicle-addendum-*.pdf). generation_enabled=FALSE per PRD-55. Re-enable when PDFs sourced.'
WHERE form_id = 'vehicle_addendum';

UPDATE public.pbv_form_templates
SET generation_enabled = FALSE,
    notes = 'Source PDFs missing (self-employment-worksheet-*.pdf). generation_enabled=FALSE per PRD-55. Re-enable when PDFs sourced.'
WHERE form_id = 'self_employment_worksheet';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Disable generation for upload-only forms
--    These are tenant-uploaded documents, not generated/stamped PDFs.
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert criminal_background_release if not present, or update if it is
INSERT INTO public.pbv_form_templates
  (form_id, display_name_en, display_name_es, generation_enabled, source_pdf_status, per_person_scope, conditional_rule, category, notes)
VALUES
  (
    'criminal_background_release',
    'Criminal Background Release',
    'Autorización de Antecedentes Penales',
    FALSE, 'pending', 'each_adult', NULL, 'upload',
    'Upload-only form (office provides, tenant signs). generation_enabled=FALSE per PRD-55.'
  )
ON CONFLICT (form_id) DO UPDATE SET
  generation_enabled = FALSE,
  category = 'upload',
  notes = 'Upload-only form (office provides, tenant signs). generation_enabled=FALSE per PRD-55.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually to verify):
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT form_id, generation_enabled, source_pdf_status, category, notes
-- FROM public.pbv_form_templates
-- ORDER BY generation_enabled DESC, form_id;
