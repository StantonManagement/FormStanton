-- PRD-62: Signing Unification & Audit-Trail Integrity
-- Date: 2026-05-21
--
-- Adds pbv_form_documents.unsigned_pdf_hash so finalize can verify that the
-- bytes each signer hashed at sign-time still match the bytes that would be
-- presented today. This is distinct from source_pdf_hash, which hashes the
-- template PDF — unsigned_pdf_hash hashes the stamped unsigned PDF the signer
-- actually downloads and signs against.
--
-- Set by generate-forms at upload time; checked by validateReadyToFinalize
-- (Check 5). Null on legacy rows = skip (no retroactive block).
--
-- Status: NOT YET APPLIED — listed in OPEN-DECISIONS.md for deliberate apply.

ALTER TABLE public.pbv_form_documents
  ADD COLUMN IF NOT EXISTS unsigned_pdf_hash TEXT;

COMMENT ON COLUMN public.pbv_form_documents.unsigned_pdf_hash IS
  'sha256(hex) of the stamped unsigned PDF bytes the signer downloads and hashes. '
  'Distinct from source_pdf_hash (which hashes the source template PDF). '
  'Used by validateReadyToFinalize Check 5 to detect post-sign content drift. '
  'Set by /generate-forms at unsigned-PDF upload time (PRD-62).';
