-- PRD-87 Phase 3 — pre-send document review approvals.
--
-- Status: COMMIT-ONLY. Do NOT apply from the build environment. Alex / Windsurf
-- applies via Supabase MCP / `db push`.
--
-- Records an operator's decision to release (or hold) an applicant's generated
-- document package before the pbv_preflight_checklist signing handoff is sent.
-- The approval is bound to `package_revision` — a content hash over the rendered
-- bytes the operator actually reviewed (hash of sorted (form_id, unsigned_pdf_hash)).
-- When documents are regenerated, unsigned_pdf_hash changes → the current revision
-- changes → a prior approval no longer matches → the send is blocked until a fresh
-- approval. Append-only: a new decision supersedes older rows for the application;
-- the latest row is authoritative.

CREATE TABLE IF NOT EXISTS public.pbv_document_review_approvals (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID        NOT NULL
    REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  package_revision TEXT        NOT NULL,
  status           TEXT        NOT NULL CHECK (status IN ('approved', 'held')),
  approved_by      UUID,
  approved_by_name TEXT,
  approved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Latest decision per application is read on every preflight send / dashboard render.
CREATE INDEX IF NOT EXISTS pdra_app_created_idx
  ON public.pbv_document_review_approvals (application_id, created_at DESC);

-- A fast path for "is THIS package revision currently approved" lookups.
CREATE INDEX IF NOT EXISTS pdra_app_revision_idx
  ON public.pbv_document_review_approvals (application_id, package_revision);

ALTER TABLE public.pbv_document_review_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access on pbv_document_review_approvals"
  ON public.pbv_document_review_approvals;
CREATE POLICY "service_role full access on pbv_document_review_approvals"
  ON public.pbv_document_review_approvals
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.pbv_document_review_approvals IS
  'PRD-87: operator pre-send review decisions. Approval bound to package_revision = hash(sorted (form_id, unsigned_pdf_hash)); regeneration changes the revision and voids a prior approval.';
