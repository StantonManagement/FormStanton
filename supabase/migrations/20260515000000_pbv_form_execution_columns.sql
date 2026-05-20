-- PRD-24: PBV Form Execution — column additions
-- Extends pbv_full_applications and pbv_household_members for form execution workflow.
-- Additive only — no existing columns are dropped or renamed.
-- Apply after: 20260514120000_tenant_notifications_unified.sql

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pbv_full_applications — form execution workflow columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS submission_language       TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS intake_data               JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intake_status             TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS signing_status            TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS intake_started_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intake_completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_completed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_to_hach_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resume_token_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resume_token_last_sent_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.pbv_full_applications
    ADD CONSTRAINT pbv_submission_language_check
      CHECK (submission_language IN ('en', 'es'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.pbv_full_applications
    ADD CONSTRAINT pbv_intake_status_check
      CHECK (intake_status IN ('not_started', 'in_progress', 'complete'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE public.pbv_full_applications
    ADD CONSTRAINT pbv_signing_status_check
      CHECK (signing_status IN ('not_started', 'summary_signed', 'in_progress', 'complete'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMENT ON COLUMN public.pbv_full_applications.submission_language IS
  'Language for federal form generation. en | es. PT speakers default to es. '
  'Separate from preferred_language which controls UI language.';

COMMENT ON COLUMN public.pbv_full_applications.intake_data IS
  'Single source of truth for tenant intake answers. Structured per PRD-25 section schema. '
  'Each section is a top-level key: household, income, assets, criminal, etc.';

COMMENT ON COLUMN public.pbv_full_applications.intake_status IS
  'Phase 1 intake progress. not_started → in_progress → complete. '
  'Distinct from stanton_review_status which is staff-side.';

COMMENT ON COLUMN public.pbv_full_applications.signing_status IS
  'Phase 2 signing progress. not_started → summary_signed → in_progress → complete.';

COMMENT ON COLUMN public.pbv_full_applications.resume_token_expires_at IS
  'When tenant_access_token becomes invalid for resuming. NULL = no expiry set yet.';

COMMENT ON COLUMN public.pbv_full_applications.resume_token_last_sent_at IS
  'Last time the resume SMS link was re-sent. Used for rate-limiting re-send requests.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pbv_household_members — per-adult signing device tracking + magic link
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.pbv_household_members
  ADD COLUMN IF NOT EXISTS signing_device       TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS magic_link_token     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.pbv_household_members
    ADD CONSTRAINT pbv_member_signing_device_check
      CHECK (signing_device IN ('self', 'hoh_device', 'staff_assisted', 'unknown'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

COMMENT ON COLUMN public.pbv_household_members.signing_device IS
  'Device context when this member signed. Populated at sign time, not intake. '
  'self = own device via magic link | hoh_device = signed on HOH device during Phase 2 '
  '| staff_assisted = staff-guided signing | unknown = not yet set.';

COMMENT ON COLUMN public.pbv_household_members.magic_link_token IS
  'Per-adult magic link token for Phase 3 fallback (HOH sends link to additional adults). '
  'Generated via lib/generateToken.ts. NULL until HOH explicitly triggers the send-link action.';

COMMENT ON COLUMN public.pbv_household_members.magic_link_expires_at IS
  '30 days from generation. After expiry, HOH must regenerate.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- ALTER TABLE public.pbv_household_members
--   DROP COLUMN IF EXISTS signing_device,
--   DROP COLUMN IF EXISTS magic_link_token,
--   DROP COLUMN IF EXISTS magic_link_expires_at;
-- ALTER TABLE public.pbv_full_applications
--   DROP COLUMN IF EXISTS submission_language,
--   DROP COLUMN IF EXISTS intake_data,
--   DROP COLUMN IF EXISTS intake_status,
--   DROP COLUMN IF EXISTS signing_status,
--   DROP COLUMN IF EXISTS intake_started_at,
--   DROP COLUMN IF EXISTS intake_completed_at,
--   DROP COLUMN IF EXISTS signing_completed_at,
--   DROP COLUMN IF EXISTS submitted_to_hach_at,
--   DROP COLUMN IF EXISTS resume_token_expires_at,
--   DROP COLUMN IF EXISTS resume_token_last_sent_at;
-- ─────────────────────────────────────────────────────────────────────────────
