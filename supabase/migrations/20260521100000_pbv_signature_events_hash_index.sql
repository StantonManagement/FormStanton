-- PRD-75 Phase 2 — covering index for finalizeValidation Check 5.
--
-- Audit finding #11 (MEDIUM, stress test 2026-05-21, reframed).
-- `lib/pbv/finalizeValidation.ts:141-142` runs:
--   .select('document_hash, signer_member_id')
--   .eq('form_document_id', formDoc.id)
-- per finalized form. An index on `form_document_id` already exists
-- (`idx_pbv_signature_events_form` from 20260515020000) so the equality
-- filter is NOT doing a sequential scan. This new index adds `document_hash`
-- to the index tuple so the query planner can satisfy Check 5 with an
-- index-only scan, skipping the heap fetch.
--
-- Given the `one_event_per_signer_per_form` unique constraint, there are
-- only a handful of rows per `form_document_id`, so the practical gain is
-- small at today's data volumes — but the index is cheap and harmless,
-- and the optimization compounds at scale.
--
-- The narrower single-column index is intentionally kept (other queries
-- filter on `form_document_id` alone and benefit from the smaller index).
--
-- Status: COMMIT-ONLY. Listed in OPEN-DECISIONS as MIGRATION-TO-APPLY.

CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_form_hash
  ON public.pbv_signature_events (form_document_id, document_hash);

COMMENT ON INDEX public.idx_pbv_signature_events_form_hash IS
  'PRD-75: covering index for finalizeValidation Check 5 (document_hash lookup by form_document_id). Enables index-only scans; complements the narrower idx_pbv_signature_events_form which still serves filter-only queries.';
