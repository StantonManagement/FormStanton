-- PRD-65: Required Government Photo ID as the First Scanned Document
-- Date: 2026-05-21
--
-- The PBV full-app document set never asked for a government-issued photo ID.
-- The lowest existing display_order is paystubs at 10. This migration:
--   1. Inserts a `government_id` template row with display_order=5 so it sorts
--      first, category='identity' (a new top-level category), always required,
--      one slot per application (submission-level, person_slot=0). multiFile
--      capped at 2 pages in lib/pbv/cards/docContent.ts so the scanner takes
--      front + back as one 2-page PDF.
--   2. Backfills `application_documents` with a missing government_id slot for
--      every in-progress application (submitted_at IS NULL) that doesn't
--      already have one. Idempotent via WHERE NOT EXISTS. Finalized packets
--      are NOT touched (per PRD O3 default).
--
-- Status: NOT YET APPLIED — listed in OPEN-DECISIONS for deliberate apply.
--
-- ROLLBACK:
--   DELETE FROM public.application_documents
--    WHERE anchor_type='pbv_full_application' AND doc_type='government_id' AND created_by='system';
--   DELETE FROM public.form_document_templates
--    WHERE form_id='pbv-full-application' AND doc_type='government_id';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Template row
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.form_document_templates
  (form_id, doc_type, label, label_es, label_pt, required, conditional_on, display_order, per_person, applies_to, member_filter, category)
VALUES
(
  'pbv-full-application', 'government_id',
  'Government-Issued Photo ID',
  'Identificación con foto emitida por el gobierno',
  'Identidade com foto emitida pelo governo',
  TRUE, NULL, 5, FALSE, 'submission',
  NULL,
  'identity'
)
ON CONFLICT (form_id, doc_type) DO UPDATE SET
  label            = EXCLUDED.label,
  label_es         = EXCLUDED.label_es,
  label_pt         = EXCLUDED.label_pt,
  required         = EXCLUDED.required,
  conditional_on   = EXCLUDED.conditional_on,
  display_order    = EXCLUDED.display_order,
  per_person       = EXCLUDED.per_person,
  applies_to       = EXCLUDED.applies_to,
  member_filter    = EXCLUDED.member_filter,
  category         = EXCLUDED.category;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill in-progress applications
--
-- Only un-submitted apps (submitted_at IS NULL) get the new required row, so
-- already-finalized packets aren't retroactively marked incomplete. Tenants
-- with an in-flight application will see a new required document on their
-- next visit.
--
-- person_slot=0 because applies_to='submission' (one ID per application).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.application_documents
  (anchor_type, anchor_id, doc_type, label, required, display_order, person_slot, status, category, created_by)
SELECT
  'pbv_full_application',
  a.id,
  'government_id',
  'Government-Issued Photo ID',
  TRUE,
  5,
  0,
  'missing',
  'identity',
  'system'
FROM public.pbv_full_applications a
WHERE a.submitted_at IS NULL
  AND EXISTS (
    -- Only seed for apps that already have some seeded docs (intake complete).
    SELECT 1
    FROM public.application_documents ad
    WHERE ad.anchor_type = 'pbv_full_application'
      AND ad.anchor_id   = a.id
  )
  AND NOT EXISTS (
    -- Idempotent: skip apps that already have a government_id slot.
    SELECT 1
    FROM public.application_documents ad2
    WHERE ad2.anchor_type = 'pbv_full_application'
      AND ad2.anchor_id   = a.id
      AND ad2.doc_type    = 'government_id'
  );
