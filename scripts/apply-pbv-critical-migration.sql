-- CRITICAL FIX: Apply this in Supabase SQL Editor for project lieeeqqvshobnqofcdac
-- This adds the columns the PBV bootstrap API expects.

-- 1. pbv_full_applications — form execution workflow columns
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

-- 2. pbv_household_members — per-adult signing device tracking + magic link
ALTER TABLE public.pbv_household_members
  ADD COLUMN IF NOT EXISTS signing_device       TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS magic_link_token     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.pbv_household_members
    ADD CONSTRAINT pbv_member_signing_device_check
      CHECK (signing_device IN ('self', 'hoh_device', 'staff_assisted', 'unknown'));
EXCEPTION WHEN duplicate_object THEN null; END $$;
