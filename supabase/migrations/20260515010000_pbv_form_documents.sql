-- PRD-24: pbv_form_documents
-- One row per (application × form_id × language). Tracks generated stamped PDFs.
-- Apply after: 20260515000000_pbv_form_execution_columns.sql

CREATE TABLE IF NOT EXISTS public.pbv_form_documents (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id         UUID        NOT NULL
    REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  form_id                     TEXT        NOT NULL,
  language                    TEXT        NOT NULL,
  status                      TEXT        NOT NULL DEFAULT 'pending_generation'
    CHECK (status IN ('pending_generation', 'generated', 'signed', 'finalized', 'skipped')),
  unsigned_pdf_path           TEXT,
  signed_pdf_path             TEXT,
  field_data_snapshot         JSONB,
  source_pdf_hash             TEXT,
  field_map_version           TEXT,
  generated_at                TIMESTAMPTZ,
  finalized_at                TIMESTAMPTZ,
  required_signer_member_ids  UUID[]      NOT NULL DEFAULT '{}',
  collected_signer_member_ids UUID[]      NOT NULL DEFAULT '{}',
  conditional_trigger         TEXT,
  feature_flag_key            TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                  TEXT,
  CONSTRAINT pbv_form_documents_unique_form
    UNIQUE (full_application_id, form_id, language)
);

CREATE INDEX IF NOT EXISTS idx_pbv_form_documents_app
  ON public.pbv_form_documents (full_application_id);

CREATE INDEX IF NOT EXISTS idx_pbv_form_documents_status
  ON public.pbv_form_documents (status);

CREATE INDEX IF NOT EXISTS idx_pbv_form_documents_app_status
  ON public.pbv_form_documents (full_application_id, status);

CREATE TRIGGER set_pbv_form_documents_updated_at
  BEFORE UPDATE ON public.pbv_form_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE public.pbv_form_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_form_documents"
  ON public.pbv_form_documents
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.pbv_form_documents IS
  'One row per (application × form_id × language). Tracks the lifecycle of each generated '
  'stamped PDF from pending_generation through signed and finalized. '
  'unsigned_pdf_path: stamped-but-unsigned PDF in Supabase Storage. '
  'signed_pdf_path: final PDF with all required signatures applied. '
  'required_signer_member_ids: pbv_household_members.id values that must sign. '
  'collected_signer_member_ids: subset populated as signatures arrive.';

COMMENT ON COLUMN public.pbv_form_documents.field_data_snapshot IS
  'Exact field data used when the PDF was stamped. Stored for audit purposes — '
  'can reconstruct what the tenant was shown at any time.';

COMMENT ON COLUMN public.pbv_form_documents.source_pdf_hash IS
  'SHA-256 of the source template PDF at stamp time. Detects template drift.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- DROP TABLE IF EXISTS public.pbv_form_documents CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────
