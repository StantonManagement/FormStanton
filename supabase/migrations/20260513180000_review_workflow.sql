-- =============================================================================
-- Review Workflow — Assignment, Bulk Operations, Application Lead, Tier-2 Confirmation
-- Phase 1 + Phase 2 combined migration
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. form_submission_documents — assignment + tier-2 fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.form_submission_documents
  -- Assignment (tier-1 reviewer)
  ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  -- Application Lead's tier-2 confirmation
  ADD COLUMN IF NOT EXISTS owner_review_status TEXT
    CHECK (owner_review_status IS NULL
      OR owner_review_status IN ('pending', 'confirmed', 'flagged')),
  ADD COLUMN IF NOT EXISTS owner_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_reviewed_by UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_flag_reason TEXT;

-- Status enum gains 'flagged_for_rereview' (when Lead flags a tier-1 action)
-- Drop the old constraint and recreate with the new value
ALTER TABLE public.form_submission_documents
  DROP CONSTRAINT IF EXISTS fsd_status_chk;

ALTER TABLE public.form_submission_documents
  ADD CONSTRAINT fsd_status_chk
  CHECK (status IN (
    'missing', 'submitted', 'approved', 'rejected', 'waived',
    'flagged_for_rereview'
  ));

CREATE INDEX IF NOT EXISTS idx_fsd_assigned_to
  ON public.form_submission_documents (assigned_to_user_id, status)
  WHERE assigned_to_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsd_owner_review_status
  ON public.form_submission_documents (owner_review_status)
  WHERE owner_review_status IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pbv_full_applications — Application Lead
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS lead_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lead_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_assigned_by UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pbv_full_apps_lead
  ON public.pbv_full_applications (lead_user_id)
  WHERE lead_user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Convenience view for queue lookups
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.assigned_documents AS
  SELECT
    d.id AS document_id,
    d.assigned_to_user_id,
    d.assigned_at,
    d.assigned_by_user_id,
    d.doc_type,
    d.label,
    d.status,
    d.revision,
    d.owner_review_status,
    fs.id AS form_submission_id,
    pfa.id AS application_id,
    pfa.lead_user_id,
    pfa.head_of_household_name,
    pfa.building_address,
    pfa.unit_number,
    pfa.stanton_review_status
  FROM public.form_submission_documents d
  JOIN public.form_submissions fs ON fs.id = d.form_submission_id
  JOIN public.pbv_full_applications pfa ON pfa.form_submission_id = fs.id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Event type helpers — add new event types for this workflow
-- These are documented in lib/events/application-events.ts
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE public.application_events IS
  'Canonical workflow timeline. Event types include:
   - document.uploaded_by_staff
   - document.recategorized
   - document.approved
   - document.rejected
   - document.waived
   - handoff.sent
   - handoff.reopened
   - doc_assigned (NEW)
   - app_lead_assigned (NEW)
   - doc_owner_confirmed (NEW)
   - doc_owner_flagged (NEW)';
