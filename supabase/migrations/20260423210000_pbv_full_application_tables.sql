-- PBV Full Application: core tables
-- Creates: pbv_full_applications, pbv_household_members, pbv_access_log
-- Apply after: 20260423000000_add_pbv_preapp_tables.sql
--              20260423180000_foundation_review_per_document.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pbv_full_applications
--    One row per full application. Links to pre-application and to the
--    per-document form_submissions row (which owns document slots).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.pbv_full_applications (
  id                                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  preapp_id                         UUID        REFERENCES public.pbv_preapplications(id),
  form_submission_id                UUID        NOT NULL REFERENCES public.form_submissions(id),
  building_address                  TEXT        NOT NULL,
  unit_number                       TEXT        NOT NULL,
  head_of_household_name            TEXT        NOT NULL,
  household_size                    INTEGER     NOT NULL,
  bedroom_count                     INTEGER,
  total_annual_income               NUMERIC(10,2),
  dv_status                         BOOLEAN     NOT NULL DEFAULT FALSE,
  homeless_at_admission             BOOLEAN     NOT NULL DEFAULT FALSE,
  claiming_medical_deduction        BOOLEAN     NOT NULL DEFAULT FALSE,
  has_childcare_expense             BOOLEAN     NOT NULL DEFAULT FALSE,
  reasonable_accommodation_requested BOOLEAN   NOT NULL DEFAULT FALSE,
  stanton_review_status             TEXT        NOT NULL DEFAULT 'pending'
    CHECK (stanton_review_status IN ('pending', 'under_review', 'approved', 'denied', 'needs_info')),
  stanton_reviewer                  TEXT,
  stanton_review_date               TIMESTAMPTZ,
  stanton_review_notes              TEXT,
  hha_application_file              TEXT,
  summary_pdf_file                  TEXT,
  tenant_access_token               TEXT        UNIQUE,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                        TEXT
);

ALTER TABLE public.pbv_full_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_full_applications"
  ON public.pbv_full_applications
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_pbv_full_applications_updated_at
  BEFORE UPDATE ON public.pbv_full_applications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE UNIQUE INDEX idx_pbv_full_applications_token
  ON public.pbv_full_applications (tenant_access_token)
  WHERE tenant_access_token IS NOT NULL;

CREATE INDEX idx_pbv_full_applications_preapp
  ON public.pbv_full_applications (preapp_id);

CREATE INDEX idx_pbv_full_applications_form_submission
  ON public.pbv_full_applications (form_submission_id);

CREATE INDEX idx_pbv_full_applications_building
  ON public.pbv_full_applications (building_address, unit_number);

COMMENT ON TABLE public.pbv_full_applications IS
  'One row per PBV full application. preapp_id nullable (some applicants skip pre-app). '
  'form_submission_id links to per-document review system for document tracking. '
  'tenant_access_token is the magic-link token for the full-app tenant portal (Phase 5).';

COMMENT ON COLUMN public.pbv_full_applications.tenant_access_token IS
  'Magic-link token for the Phase 5 tenant portal. NULL until the admin sends the invitation. '
  'Generate with lib/generateToken.ts (32-byte hex).';

COMMENT ON COLUMN public.pbv_full_applications.dv_status IS
  'TRUE if applicant disclosed domestic violence situation. '
  'Controls whether VAWA certification documents are required.';

COMMENT ON COLUMN public.pbv_full_applications.claiming_medical_deduction IS
  'Controls whether medical deduction document slots are shown/required (Phase 5 UI).';

COMMENT ON COLUMN public.pbv_full_applications.has_childcare_expense IS
  'Controls whether Care 4 Kids certificate document slot is shown/required (Phase 5 UI).';

COMMENT ON COLUMN public.pbv_full_applications.reasonable_accommodation_requested IS
  'Controls whether RA request form document slots are required (Phase 5 UI).';

COMMENT ON COLUMN public.pbv_full_applications.stanton_review_status IS
  'Internal Stanton staff review status. Separate from hha qualification. '
  'pending → under_review → approved | denied | needs_info';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pbv_household_members
--    One row per person in the household. Head of household is slot = 1.
--    SSN stored encrypted; only ssn_last_four in plaintext.
--    Boolean income flags derived from income_sources at intake form submission.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.pbv_household_members (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id   UUID        NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  slot                  INTEGER     NOT NULL CHECK (slot >= 1),
  name                  TEXT        NOT NULL,
  date_of_birth         DATE,
  age                   INTEGER,
  relationship          TEXT        NOT NULL
    CHECK (relationship IN ('head', 'spouse', 'partner', 'child', 'other')),
  ssn_encrypted         TEXT,
  ssn_last_four         TEXT,
  annual_income         NUMERIC(10,2) NOT NULL DEFAULT 0,
  income_sources        TEXT[]      NOT NULL DEFAULT '{}',
  employed              BOOLEAN     NOT NULL DEFAULT FALSE,
  has_ssi               BOOLEAN     NOT NULL DEFAULT FALSE,
  has_ss                BOOLEAN     NOT NULL DEFAULT FALSE,
  has_pension           BOOLEAN     NOT NULL DEFAULT FALSE,
  has_tanf              BOOLEAN     NOT NULL DEFAULT FALSE,
  has_child_support     BOOLEAN     NOT NULL DEFAULT FALSE,
  has_unemployment      BOOLEAN     NOT NULL DEFAULT FALSE,
  has_self_employment   BOOLEAN     NOT NULL DEFAULT FALSE,
  has_other_income      BOOLEAN     NOT NULL DEFAULT FALSE,
  disability            BOOLEAN     NOT NULL DEFAULT FALSE,
  student               BOOLEAN     NOT NULL DEFAULT FALSE,
  citizenship_status    TEXT        NOT NULL DEFAULT 'not_reported'
    CHECK (citizenship_status IN ('citizen', 'eligible_non_citizen', 'ineligible', 'not_reported')),
  criminal_history      BOOLEAN,
  signature_required    BOOLEAN     NOT NULL DEFAULT FALSE,
  signature_image       TEXT,
  signature_date        DATE,
  signed_forms          TEXT[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT,
  UNIQUE (full_application_id, slot)
);

ALTER TABLE public.pbv_household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_household_members"
  ON public.pbv_household_members
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX idx_pbv_household_members_application
  ON public.pbv_household_members (full_application_id);

COMMENT ON TABLE public.pbv_household_members IS
  'One row per household member. Slot 1 = head of household. '
  'ssn_encrypted holds AES-256-GCM ciphertext from lib/ssnEncryption.ts. '
  'Boolean income flags (employed, has_ssi, etc.) are derived from income_sources '
  'at intake form submission time; these are what member_filter criteria evaluate against.';

COMMENT ON COLUMN public.pbv_household_members.age IS
  'Computed from date_of_birth at intake form submission time. '
  'Must be present for each_adult document slot seeding to work correctly '
  '(getApplicableMembers checks member.age >= 18).';

COMMENT ON COLUMN public.pbv_household_members.ssn_encrypted IS
  'AES-256-GCM ciphertext. Format: {iv_hex}:{authTag_hex}:{ciphertext_hex}. '
  'Decrypted only in role-gated server functions. Every decrypt must log to pbv_access_log.';

COMMENT ON COLUMN public.pbv_household_members.ssn_last_four IS
  'Last 4 digits of SSN in plaintext. Derived at intake, never updated. '
  'Used for display and identity confirmation only. Cannot reconstruct full SSN.';

COMMENT ON COLUMN public.pbv_household_members.criminal_history IS
  'NULL = question not yet answered. TRUE = disclosed criminal history. '
  'FALSE = no criminal history disclosed.';

COMMENT ON COLUMN public.pbv_household_members.signature_required IS
  'TRUE when age >= 18 at intake. Controls whether this member appears in the Phase 4 signing queue.';

COMMENT ON COLUMN public.pbv_household_members.signed_forms IS
  'Array of doc_type slugs that this member has signed. Populated during Phase 4 multi-signer flow.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pbv_access_log
--    Append-only log of every sensitive data access.
--    Every call to decryptSsn() for a PBV member must insert a row here.
--    No hard deletes. No UPDATE policy (service_role INSERT only in practice).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.pbv_access_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  accessed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       TEXT        NOT NULL,
  action        TEXT        NOT NULL
    CHECK (action IN ('read_ssn', 'export_application', 'generate_hha', 'admin_view_ssn')),
  resource_type TEXT        NOT NULL
    CHECK (resource_type IN ('pbv_household_member', 'pbv_full_application')),
  resource_id   UUID        NOT NULL,
  ip_address    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    TEXT
);

ALTER TABLE public.pbv_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_access_log"
  ON public.pbv_access_log
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX idx_pbv_access_log_resource
  ON public.pbv_access_log (resource_type, resource_id);

CREATE INDEX idx_pbv_access_log_user
  ON public.pbv_access_log (user_id, accessed_at DESC);

CREATE INDEX idx_pbv_access_log_accessed_at
  ON public.pbv_access_log (accessed_at DESC);

COMMENT ON TABLE public.pbv_access_log IS
  'Append-only audit log. Every decrypted SSN read, application export, and HHA generation '
  'must insert a row here. No application-level deletes. Retained per HACH data retention policy.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- Safe to roll back only if no rows exist in the new tables.
--
-- DROP TABLE IF EXISTS public.pbv_access_log CASCADE;
-- DROP TABLE IF EXISTS public.pbv_household_members CASCADE;
-- DROP TABLE IF EXISTS public.pbv_full_applications CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────
