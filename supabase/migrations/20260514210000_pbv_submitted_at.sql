-- =============================================================================
-- PRD-15: Submission Finalization & Locking
-- Add submitted_at timestamp to pbv_full_applications as the server-side
-- invariant for "application is complete and locked".
--
-- ROLLBACK:
--   ALTER TABLE public.pbv_full_applications DROP COLUMN IF EXISTS submitted_at;
--   DROP INDEX IF EXISTS idx_pbv_full_applications_submitted_at;
-- =============================================================================

-- Add submitted_at column (nullable, set-once pattern)
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

-- Partial index for fast lookup of submitted applications
CREATE INDEX IF NOT EXISTS idx_pbv_full_applications_submitted_at
  ON public.pbv_full_applications (submitted_at)
  WHERE submitted_at IS NOT NULL;
