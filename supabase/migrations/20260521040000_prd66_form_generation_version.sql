-- PRD-66: Form Generation Version (regenerate-lock)
-- Date: 2026-05-21
--
-- Adds pbv_form_documents.generation_version, the monotonically-increasing
-- regeneration counter. Bumped each time generate-forms re-stamps a form
-- with at least one signer already collected (the regenerate-during-signing
-- case, audit finding #5). A clean regenerate before any signature has been
-- collected reuses version 1 and `upsert: true` on the same versioned path.
--
-- The unsigned-PDF storage path is suffixed with `-v${generation_version}`
-- (see app/api/t/[token]/pbv-full-app/generate-forms/route.ts) so a bumped
-- version writes a NEW object rather than clobbering bytes a prior signer
-- already hashed into a pbv_signature_events.document_hash.
--
-- Enforcement of "signed-against version no longer matches current version"
-- rides PRD-62's pbv_form_documents.unsigned_pdf_hash + finalizeValidation
-- Check 5: bumping the version rewrites unsigned_pdf_hash, so any signature
-- event whose recorded document_hash != the new unsigned_pdf_hash already
-- blocks finalize with "hash mismatch — please re-sign". No new column on
-- pbv_signature_events is needed; logged as PRD O2.
--
-- Status: NOT YET APPLIED — listed in OPEN-DECISIONS for deliberate apply.
--
-- ROLLBACK: ALTER TABLE public.pbv_form_documents DROP COLUMN IF EXISTS generation_version;

ALTER TABLE public.pbv_form_documents
  ADD COLUMN IF NOT EXISTS generation_version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.pbv_form_documents.generation_version IS
  'Monotonically-increasing regeneration counter. Bumped by generate-forms each '
  'time the form is re-stamped with at least one collected signer. The unsigned-'
  'PDF storage path is suffixed -v${generation_version} so bumping produces a '
  'new object rather than clobbering bytes a signer already hashed. Enforcement '
  'of "signed-against version stale" rides PRD-62 unsigned_pdf_hash Check 5.';
