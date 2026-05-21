-- PRD-55b: Form-Sourcing Corrections
-- Date: 2026-05-21
--
-- PRD-55 classified forms by checking only assets/pbv-source-pdfs/ and missed
-- sources that already lived in docs/templates/. This corrective migration:
--   1. Re-enables criminal_background_release as a generate-and-sign form
--      (source pp 39–40 of the bilingual packet; extracted PDFs already existed).
--   2. Re-enables eiv_guide_receipt (source PDFs + field map already existed).
--   3. Disables insurance_settlement + cd_trust_bond — they were in the live
--      generate-forms skip list (enabled + silently skipping) before PRD-55 and
--      have no source PDFs anywhere. Default-disable per PRD-55b D2 carry-forward.
--
-- PRD-55's migration was already applied to prod, so this corrective migration
-- must be applied deliberately as well. See OPEN-DECISIONS.md.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Re-enable criminal_background_release as a generate-and-sign form
--    Reverses PRD-55's "upload-only" classification. Source: pp 39–40 of
--    "Full Application Package (5-28-2025 bilingual).pdf"; extracted PDFs at
--    docs/templates/criminal-background-release-{en,es}.pdf (copied to assets/).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.pbv_form_templates
SET generation_enabled = TRUE,
    category = 'sign',
    source_pdf_status = 'ready',
    notes = 'Generate-and-sign form. Sourced from packet pp 39–40 (re-enabled in PRD-55b after PRD-55 wrongly classified as upload-only).'
WHERE form_id = 'criminal_background_release';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Re-enable eiv_guide_receipt (default enable per PRD-55b O1)
--    Source: packet pp 25–28 (ES guide pages blank — ES PDF uses EN signature
--    page coordinates per field map; see PRD-23). Single-signer receipt.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.pbv_form_templates
SET generation_enabled = TRUE,
    source_pdf_status = 'ready',
    notes = 'Signed receipt for EIV/Notice and Consent guide. Sourced + field-mapped in PRD-23; re-enabled in PRD-55b.'
WHERE form_id = 'eiv_guide_receipt';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Disable insurance_settlement + cd_trust_bond — unsourced, silently skipping
--    PRD-55's reconciliation missed these. No source PDF anywhere (not in
--    packet, not in docs/templates/). Default-disable so they stop silently
--    skipping. If they turn out to be real currently-needed HACH forms, source
--    the PDFs and flip back to TRUE; tracked as BLOCKER in OPEN-DECISIONS.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.pbv_form_templates
SET generation_enabled = FALSE,
    source_pdf_status = 'pending',
    notes = 'Disabled in PRD-55b. No source PDFs anywhere; was silently skipping. Re-enable when/if HACH source materials are provided.'
WHERE form_id = 'insurance_settlement';

UPDATE public.pbv_form_templates
SET generation_enabled = FALSE,
    source_pdf_status = 'pending',
    notes = 'Disabled in PRD-55b. No source PDFs anywhere; was silently skipping. Re-enable when/if HACH source materials are provided.'
WHERE form_id = 'cd_trust_bond';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification queries (run manually after applying):
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT form_id, generation_enabled, source_pdf_status, category, notes
-- FROM public.pbv_form_templates
-- WHERE form_id IN ('criminal_background_release', 'eiv_guide_receipt',
--                   'insurance_settlement', 'cd_trust_bond')
-- ORDER BY form_id;
