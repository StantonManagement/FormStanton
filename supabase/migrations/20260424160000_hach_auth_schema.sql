-- HACH Auth Schema — Phase 1
-- Adds user_type discrimination to admin_users, creates hach_user_invitations,
-- and extends audit_log with HACH-relevant columns.
-- Idempotent: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout.
--
-- Rollback:
--   ALTER TABLE public.admin_users DROP COLUMN IF EXISTS user_type;
--   ALTER TABLE public.admin_users DROP COLUMN IF EXISTS deactivated_at;
--   ALTER TABLE public.admin_users DROP COLUMN IF EXISTS last_login_at;
--   DROP TABLE IF EXISTS public.hach_user_invitations CASCADE;
--   ALTER TABLE public.audit_log DROP COLUMN IF EXISTS user_type;
--   ALTER TABLE public.audit_log DROP COLUMN IF EXISTS user_agent;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend admin_users
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'stanton_staff';

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add CHECK constraint idempotently via DO block
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'admin_users'
      AND constraint_name = 'admin_users_user_type_check'
  ) THEN
    ALTER TABLE public.admin_users
      ADD CONSTRAINT admin_users_user_type_check
        CHECK (user_type IN ('stanton_staff', 'hach_admin', 'hach_reviewer'));
  END IF;
END $$;

-- Backfill: all existing rows are Stanton staff
UPDATE public.admin_users
SET user_type = 'stanton_staff'
WHERE user_type IS NULL OR user_type NOT IN ('stanton_staff', 'hach_admin', 'hach_reviewer');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HACH user invitations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hach_user_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  user_type   TEXT        NOT NULL CHECK (user_type IN ('hach_admin', 'hach_reviewer')),
  invited_by  UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  token       TEXT        UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hach_user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on hach_user_invitations"
  ON public.hach_user_invitations
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_hach_invitations_token
  ON public.hach_user_invitations (token)
  WHERE accepted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hach_invitations_email
  ON public.hach_user_invitations (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Extend audit_log with HACH-relevant columns
--    audit_log already exists (used by lib/audit.ts). We only add new columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_type  TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_agent TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_user_type
  ON public.audit_log (user_type, created_at DESC);

COMMENT ON COLUMN public.admin_users.user_type IS
  'Discriminator: stanton_staff (default) | hach_admin | hach_reviewer. '
  'Controls which route tree the user may access.';

COMMENT ON COLUMN public.admin_users.deactivated_at IS
  'Soft-delete timestamp. Non-null = deactivated. is_active should also be set to false.';

COMMENT ON TABLE public.hach_user_invitations IS
  'One-time invitation tokens for HACH user onboarding. '
  'Token consumed on acceptance (accepted_at set). Expires after 7 days.';
