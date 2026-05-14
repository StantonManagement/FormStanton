-- =============================================================================
-- application_documents — Polymorphic document table
--
-- Mirrors form_submission_documents structurally, replacing the anchor:
--   form_submission_id UUID → (anchor_type TEXT, anchor_id UUID)
--
-- Structural parity decision: every non-anchor column on the live
-- form_submission_documents schema is carried over verbatim, including
-- label, required, display_order, reviewer, reviewed_at, notes,
-- assignment columns, and tier-2 columns.
--
-- Deviation from PRD column list: approved_by_* / rejected_by_* columns
-- do not exist on form_submission_documents and are not added here.
-- See build report "Pre-existing issues observed."
--
-- Idempotent — safe to re-apply (uses IF NOT EXISTS throughout).
-- =============================================================================

BEGIN;

-- ─── 1. Create application_documents ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.application_documents (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Polymorphic anchor (replaces form_submission_id)
  anchor_type               TEXT        NOT NULL,
  anchor_id                 UUID        NOT NULL,

  -- Document identity (mirrored from form_submission_documents)
  doc_type                  TEXT        NOT NULL,
  label                     TEXT        NOT NULL,
  required                  BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order             INTEGER     NOT NULL DEFAULT 0,
  person_slot               INTEGER     NOT NULL DEFAULT 0,
  revision                  INTEGER     NOT NULL DEFAULT 0,
  status                    TEXT        NOT NULL DEFAULT 'missing',

  -- File metadata
  file_name                 TEXT,
  storage_path              TEXT,
  file_size_bytes           BIGINT,
  mime_type                 TEXT,

  -- Signature
  requires_signature        BOOLEAN     NOT NULL DEFAULT FALSE,
  signer_scope              TEXT,

  -- Versioning / re-categorization
  original_doc_type         TEXT,

  -- Provenance
  uploaded_by_role          TEXT,
  uploaded_by_user_id       TEXT,
  uploaded_by_display_name  TEXT,
  upload_source             TEXT,
  staff_upload_note         TEXT,

  -- Legacy review attribution (mirrored from form_submission_documents)
  reviewer                  TEXT,
  reviewed_at               TIMESTAMPTZ,
  rejection_reason          TEXT,
  notes                     TEXT,

  -- Assignment (mirrored from form_submission_documents)
  assigned_to_user_id       UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  assigned_at               TIMESTAMPTZ,
  assigned_by_user_id       UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,

  -- Tier-2 review (mirrored from form_submission_documents)
  owner_review_status       TEXT,
  owner_reviewed_at         TIMESTAMPTZ,
  owner_reviewed_by         UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  owner_flag_reason         TEXT,

  -- Audit
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                TEXT,

  -- Constraints
  CONSTRAINT ad_anchor_type_check
    CHECK (anchor_type IN ('pbv_full_application')),

  CONSTRAINT ad_status_check
    CHECK (status IN ('missing', 'submitted', 'approved', 'rejected', 'waived', 'flagged_for_rereview')),

  CONSTRAINT ad_person_slot_non_negative
    CHECK (person_slot >= 0),

  CONSTRAINT ad_uploaded_by_role_check
    CHECK (uploaded_by_role IS NULL OR uploaded_by_role IN ('tenant', 'staff')),

  CONSTRAINT ad_signer_scope_check
    CHECK (signer_scope IS NULL OR signer_scope IN ('all_adults', 'hoh_only', 'individual')),

  CONSTRAINT ad_upload_source_check
    CHECK (
      upload_source IS NULL
      OR upload_source IN (
        'portal', 'in_person', 'email', 'phone_text',
        'mail_fax', 'from_hach', 'prior_file', 'other', 'packet_intake'
      )
    ),

  CONSTRAINT ad_owner_review_status_check
    CHECK (owner_review_status IS NULL OR owner_review_status IN ('pending', 'confirmed', 'flagged')),

  -- Revision uniqueness: one row per (anchor, doc_type, person_slot, revision)
  CONSTRAINT ad_revision_unique
    UNIQUE (anchor_type, anchor_id, doc_type, person_slot, revision)
);


-- ─── 2. Indexes ───────────────────────────────────────────────────────────────

-- Primary lookup
CREATE INDEX IF NOT EXISTS idx_ad_anchor
  ON public.application_documents (anchor_type, anchor_id);

-- Versioning queries
CREATE INDEX IF NOT EXISTS idx_ad_anchor_type_slot_revision
  ON public.application_documents (anchor_type, anchor_id, doc_type, person_slot, revision DESC);

-- Review-surface filters
CREATE INDEX IF NOT EXISTS idx_ad_anchor_status
  ON public.application_documents (anchor_type, anchor_id, status);

-- Cross-application reports
CREATE INDEX IF NOT EXISTS idx_ad_doc_type
  ON public.application_documents (doc_type);

-- Assignment
CREATE INDEX IF NOT EXISTS idx_ad_assigned_to
  ON public.application_documents (assigned_to_user_id, status)
  WHERE assigned_to_user_id IS NOT NULL;

-- Tier-2
CREATE INDEX IF NOT EXISTS idx_ad_owner_review_status
  ON public.application_documents (owner_review_status)
  WHERE owner_review_status IS NOT NULL;


-- ─── 3. updated_at trigger ────────────────────────────────────────────────────

CREATE TRIGGER set_application_documents_updated_at
  BEFORE UPDATE ON public.application_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- ─── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.application_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on application_documents"
  ON public.application_documents
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);


COMMIT;
