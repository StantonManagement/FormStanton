-- Foundation Review Layer: Per-Document Review Schema
-- Phase 1 output — DO NOT APPLY until Alex approves Phase 1 checkpoint
-- Apply only AFTER 20260314220000_add_submission_workflow_fields.sql has been applied

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New columns on form_submissions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS review_granularity TEXT NOT NULL DEFAULT 'atomic',
  ADD COLUMN IF NOT EXISTS document_review_summary JSONB,
  ADD COLUMN IF NOT EXISTS tenant_access_token TEXT;

ALTER TABLE public.form_submissions
  ADD CONSTRAINT form_submissions_review_granularity_chk
    CHECK (review_granularity IN ('atomic', 'per_document'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_form_submissions_tenant_access_token
  ON public.form_submissions (tenant_access_token)
  WHERE tenant_access_token IS NOT NULL;

COMMENT ON COLUMN public.form_submissions.review_granularity IS
  'Opt-in flag. atomic = single status/denial on the whole submission. per_document = each document reviewed independently.';

COMMENT ON COLUMN public.form_submissions.document_review_summary IS
  'Denormalized count rollup for list-view rendering. Format: {"total": N, "approved": N, "submitted": N, "rejected": N, "missing": N, "waived": N}. Only populated when review_granularity = per_document. Never queried structurally — use form_submission_documents for joins.';

COMMENT ON COLUMN public.form_submissions.tenant_access_token IS
  'Magic-link token for the tenant per-document status page at /t/[token]. Generated at submission creation when review_granularity = per_document. No expiration at launch. NULL for atomic submissions.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. form_document_templates
--    Declares which documents a per-document form expects.
--    One row per (form_id, doc_type). Seeds form_submission_documents at
--    submission creation time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.form_document_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id         TEXT        NOT NULL,
  doc_type        TEXT        NOT NULL,
  label           TEXT        NOT NULL,
  label_es        TEXT,
  label_pt        TEXT,
  required        BOOLEAN     NOT NULL DEFAULT TRUE,
  conditional_on  JSONB,
  display_order   INTEGER     NOT NULL DEFAULT 0,
  per_person      BOOLEAN     NOT NULL DEFAULT FALSE,
  applies_to      TEXT        NOT NULL DEFAULT 'submission',
  member_filter   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  CONSTRAINT fdt_applies_to_chk CHECK (applies_to IN ('submission', 'each_member', 'each_adult', 'each_member_matching_rule')),
  UNIQUE (form_id, doc_type)
);

ALTER TABLE public.form_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on form_document_templates"
  ON public.form_document_templates
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_form_document_templates_updated_at
  BEFORE UPDATE ON public.form_document_templates
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fdt_form_id
  ON public.form_document_templates (form_id);

COMMENT ON TABLE public.form_document_templates IS
  'Template definitions: which documents each per-document form expects. Rows here seed form_submission_documents at submission creation.';

COMMENT ON COLUMN public.form_document_templates.per_person IS
  'If true, seeding creates one form_submission_documents row per matched household member (using applies_to / member_filter). If false, seeding creates one row with person_slot = 0.';

COMMENT ON COLUMN public.form_document_templates.applies_to IS
  'Which household members receive a slot. submission = one slot for the whole submission. each_member = all members. each_adult = members aged 18+. each_member_matching_rule = members matching member_filter criteria.';

COMMENT ON COLUMN public.form_document_templates.member_filter IS
  'JSONB criteria evaluated against each household_members entry when applies_to = each_member_matching_rule. Format: {"field": "employed", "value": true} or {"field": "age", "op": "gte", "value": 18}. Multiple criteria are ANDed.';

COMMENT ON COLUMN public.form_document_templates.conditional_on IS
  'Optional. If set, this document slot is only shown when form_submissions.form_data matches this shape. Format TBD per form — validated in application layer.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. form_submission_documents
--    One row per (form_submission_id, doc_type). Tracks current document state.
--    Seeded from form_document_templates at submission creation.
--    Revision history lives in form_submission_document_revisions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.form_submission_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_submission_id  UUID        NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  doc_type            TEXT        NOT NULL,
  label               TEXT        NOT NULL,
  required            BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order       INTEGER     NOT NULL DEFAULT 0,
  person_slot         INTEGER     NOT NULL DEFAULT 0,
  revision            INTEGER     NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'missing',
  file_name           TEXT,
  storage_path        TEXT,
  reviewer            TEXT,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT,
  CONSTRAINT fsd_status_chk CHECK (status IN ('missing', 'submitted', 'approved', 'rejected', 'waived')),
  CONSTRAINT fsd_person_slot_non_negative CHECK (person_slot >= 0),
  UNIQUE (form_submission_id, doc_type, person_slot)
);

ALTER TABLE public.form_submission_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on form_submission_documents"
  ON public.form_submission_documents
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_form_submission_documents_updated_at
  BEFORE UPDATE ON public.form_submission_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fsd_submission
  ON public.form_submission_documents (form_submission_id);

CREATE INDEX IF NOT EXISTS idx_fsd_status
  ON public.form_submission_documents (status);

CREATE INDEX IF NOT EXISTS idx_fsd_submission_status
  ON public.form_submission_documents (form_submission_id, status);

COMMENT ON TABLE public.form_submission_documents IS
  'Current state of each document slot in a per-document submission. revision=0 means never uploaded. Append-only history in form_submission_document_revisions.';

COMMENT ON COLUMN public.form_submission_documents.person_slot IS
  '0 = submission-level document (not tied to a specific person). 1..N = per-person instance; index into form_submissions.form_data.household_members (1-based). Name resolved at render time from household_members[person_slot - 1], never stored on this row.';

COMMENT ON COLUMN public.form_submission_documents.revision IS
  '0 = never submitted. Incremented on each tenant upload. Matches the latest row in form_submission_document_revisions.';

COMMENT ON COLUMN public.form_submission_documents.file_name IS
  'Human-readable filename at rest. Submission-level (person_slot=0): {AssetID}_{Unit} - {DocType} - {LastName} - {YYYYMMDD} - v{N}.{ext}. Per-person (person_slot>=1): {AssetID}_{Unit} - {DocType} - {LastName} - P{slot} - {YYYYMMDD} - v{N}.{ext}. Set at upload time, not export time.';

COMMENT ON COLUMN public.form_submission_documents.storage_path IS
  'Full path in Supabase storage: form-submissions/{submission_id}/{doc_type}/{file_name}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. form_submission_document_revisions
--    Append-only history. One row per file upload per document slot.
--    The parent form_submission_documents row reflects the latest revision.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.form_submission_document_revisions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID        NOT NULL REFERENCES public.form_submission_documents(id) ON DELETE CASCADE,
  revision          INTEGER     NOT NULL,
  file_name         TEXT        NOT NULL,
  storage_path      TEXT        NOT NULL,
  uploaded_by       TEXT        NOT NULL,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status_at_review  TEXT,
  rejection_reason  TEXT,
  reviewer          TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT,
  CONSTRAINT fsdr_revision_positive CHECK (revision > 0),
  CONSTRAINT fsdr_status_at_review_chk CHECK (
    status_at_review IN ('approved', 'rejected') OR status_at_review IS NULL
  ),
  UNIQUE (document_id, revision)
);

ALTER TABLE public.form_submission_document_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on form_submission_document_revisions"
  ON public.form_submission_document_revisions
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_form_submission_document_revisions_updated_at
  BEFORE UPDATE ON public.form_submission_document_revisions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_fsdr_document
  ON public.form_submission_document_revisions (document_id);

CREATE INDEX IF NOT EXISTS idx_fsdr_document_revision
  ON public.form_submission_document_revisions (document_id, revision);

COMMENT ON TABLE public.form_submission_document_revisions IS
  'Append-only revision history. Every tenant upload creates one row here and increments form_submission_documents.revision. Never mutated after insert (except updated_at trigger).';

COMMENT ON COLUMN public.form_submission_document_revisions.uploaded_by IS
  'Either the string "tenant" (for tenant uploads via /t/[token]) or the staff user id (for staff-initiated uploads).';

COMMENT ON COLUMN public.form_submission_document_revisions.status_at_review IS
  'Set when staff reviews this specific revision. NULL until reviewed. Allows seeing which revision was approved or rejected even after a newer revision exists.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- Run the following to fully revert this migration.
-- Safe to roll back only if no rows exist in the new tables.
--
-- ALTER TABLE public.form_submissions
--   DROP COLUMN IF EXISTS review_granularity,
--   DROP COLUMN IF EXISTS document_review_summary,
--   DROP COLUMN IF EXISTS tenant_access_token;
--
-- DROP TABLE IF EXISTS public.form_submission_document_revisions CASCADE;
-- DROP TABLE IF EXISTS public.form_submission_documents CASCADE;
-- DROP TABLE IF EXISTS public.form_document_templates CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────
