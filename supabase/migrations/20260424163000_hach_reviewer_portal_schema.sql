-- HACH Reviewer Portal — Phase 1 Schema
-- Adds hach_review_status to pbv_full_applications,
-- creates document_review_actions and application_view_events.
-- Idempotent: IF NOT EXISTS throughout.
--
-- Rollback:
--   ALTER TABLE public.pbv_full_applications DROP COLUMN IF EXISTS hach_review_status;
--   DROP TABLE IF EXISTS public.application_view_events CASCADE;
--   DROP TABLE IF EXISTS public.document_review_actions CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend pbv_full_applications with HACH review status
--    Kept separate from stanton_review_status so the two workflows are
--    independently tracked and neither overwrites the other.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS hach_review_status TEXT
  CHECK (hach_review_status IN ('pending_hach', 'under_hach_review', 'approved_by_hach', 'rejected_by_hach'));

CREATE INDEX IF NOT EXISTS idx_pbv_full_applications_hach_status
  ON public.pbv_full_applications (hach_review_status);

COMMENT ON COLUMN public.pbv_full_applications.hach_review_status IS
  'NULL = not yet routed to HACH. pending_hach → under_hach_review → approved_by_hach | rejected_by_hach. '
  'Independent from stanton_review_status.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. document_review_actions
--    One row per reviewer action on a document slot.
--    Append-only — no updates.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_review_actions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID        NOT NULL REFERENCES public.form_submission_documents(id) ON DELETE CASCADE,
  full_application_id UUID        NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  reviewer_id         UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reviewer_name       TEXT        NOT NULL,
  action              TEXT        NOT NULL
    CHECK (action IN ('approved', 'rejected', 'needs_info', 'waived')),
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT
);

ALTER TABLE public.document_review_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on document_review_actions"
  ON public.document_review_actions
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_dra_document
  ON public.document_review_actions (document_id);

CREATE INDEX IF NOT EXISTS idx_dra_application
  ON public.document_review_actions (full_application_id, created_at DESC);

COMMENT ON TABLE public.document_review_actions IS
  'Append-only log of HACH reviewer approve/reject/needs_info/waive actions on document slots. '
  'The latest action per document_id is the effective status. '
  'Do not update or delete rows — append new actions to supersede.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. application_view_events
--    Tracks when a reviewer first viewed a packet — used for "new since last visit".
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.application_view_events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id UUID        NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  reviewer_id         UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reviewer_name       TEXT        NOT NULL,
  viewed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.application_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on application_view_events"
  ON public.application_view_events
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_ave_application_reviewer
  ON public.application_view_events (full_application_id, reviewer_id, viewed_at DESC);

COMMENT ON TABLE public.application_view_events IS
  'One row per (reviewer, application) view. Latest viewed_at per (application, reviewer) '
  'is compared to document submission timestamps to determine "new since last visit".';
