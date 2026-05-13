-- Add source column to document_review_actions
-- Differentiates HACH-authored actions from any future Stanton-authored actions.
-- All existing rows default to 'hach' (verified: no Stanton writes exist at time of migration).
--
-- Rollback: ALTER TABLE public.document_review_actions DROP COLUMN IF EXISTS source;

ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'hach'
  CHECK (source IN ('hach', 'stanton'));

CREATE INDEX IF NOT EXISTS idx_dra_source
  ON public.document_review_actions (source, created_at DESC);

COMMENT ON COLUMN public.document_review_actions.source IS
  'Which side wrote the action. HACH endpoints filter on source = ''hach''. '
  'Defends the wall against future Stanton writes to this table.';
