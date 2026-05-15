-- PRD-24: pbv_summary_documents
-- One row per application. Holds the signed summary document that must be signed
-- before any federal form can be signed.
-- Apply after: 20260515020000_pbv_signature_events.sql

CREATE TABLE IF NOT EXISTS public.pbv_summary_documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id UUID        NOT NULL UNIQUE
    REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  language            TEXT        NOT NULL
    CHECK (language IN ('en', 'es', 'pt')),
  template_version    TEXT        NOT NULL,
  pdf_storage_path    TEXT,
  signed_at           TIMESTAMPTZ,
  signature_event_id  UUID
    REFERENCES public.pbv_signature_events(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT
);

CREATE TRIGGER set_pbv_summary_documents_updated_at
  BEFORE UPDATE ON public.pbv_summary_documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE public.pbv_summary_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_summary_documents"
  ON public.pbv_summary_documents
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.pbv_summary_documents IS
  'One row per application. The summary document must be signed before any federal form '
  'can be signed (gate enforced in sign-form endpoint). Kept separate from pbv_form_documents '
  'because it supports language=pt (trilingual) which federal forms do not.';

COMMENT ON COLUMN public.pbv_summary_documents.template_version IS
  'Which version of the summary template was used. Populated by sign-summary. '
  'Format: e.g. "2026-05-15-v1". Enables content versioning for HACH review.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- DROP TABLE IF EXISTS public.pbv_summary_documents CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────
