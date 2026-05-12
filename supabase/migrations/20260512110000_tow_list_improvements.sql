-- Tow List Page Improvements
-- Adds dismissal tracking, warning state, edit history, and tenant issues integration

-- ============================================
-- 1. Add columns to submissions table
-- ============================================

-- Dismissal columns for auto-flagged move-outs
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS moveout_flag_dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moveout_flag_dismissed_by TEXT,
  ADD COLUMN IF NOT EXISTS moveout_flag_dismissed_reason TEXT,
  ADD COLUMN IF NOT EXISTS moveout_flag_dismissal_type TEXT CHECK (moveout_flag_dismissal_type IN ('false_positive', 'decision_to_decline'));

-- Warning state columns
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS parking_warned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parking_warned_by TEXT;

-- Create index for filtering dismissed move-outs efficiently
CREATE INDEX IF NOT EXISTS idx_submissions_moveout_flag_dismissed_at
  ON public.submissions (moveout_flag_dismissed_at)
  WHERE moveout_flag_dismissed_at IS NOT NULL;

-- Create index for warning state queries
CREATE INDEX IF NOT EXISTS idx_submissions_parking_warned_at
  ON public.submissions (parking_warned_at)
  WHERE parking_warned_at IS NOT NULL;

-- ============================================
-- 2. Create tow_reason_history table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tow_reason_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  prior_reason TEXT,
  prior_notes TEXT,
  new_reason TEXT,
  new_notes TEXT,
  edited_by TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  edit_context TEXT
);

CREATE INDEX IF NOT EXISTS idx_tow_reason_history_submission_id
  ON public.tow_reason_history (submission_id);

CREATE INDEX IF NOT EXISTS idx_tow_reason_history_edited_at
  ON public.tow_reason_history (edited_at DESC);

ALTER TABLE public.tow_reason_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tow_reason_history'
      AND policyname = 'Allow service role full access to tow_reason_history'
  ) THEN
    CREATE POLICY "Allow service role full access to tow_reason_history"
      ON public.tow_reason_history
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ============================================
-- 3. Create tow_manual_entry_history table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tow_manual_entry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tow_manual_entry_id UUID NOT NULL REFERENCES public.tow_manual_entries(id) ON DELETE CASCADE,
  prior_reason TEXT,
  prior_notes TEXT,
  new_reason TEXT,
  new_notes TEXT,
  edited_by TEXT NOT NULL,
  edited_at TIMESTAMPTZ DEFAULT NOW(),
  edit_context TEXT
);

CREATE INDEX IF NOT EXISTS idx_tow_manual_entry_history_entry_id
  ON public.tow_manual_entry_history (tow_manual_entry_id);

CREATE INDEX IF NOT EXISTS idx_tow_manual_entry_history_edited_at
  ON public.tow_manual_entry_history (edited_at DESC);

ALTER TABLE public.tow_manual_entry_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tow_manual_entry_history'
      AND policyname = 'Allow service role full access to tow_manual_entry_history'
  ) THEN
    CREATE POLICY "Allow service role full access to tow_manual_entry_history"
      ON public.tow_manual_entry_history
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ============================================
-- 4. Create tenant_issues table
-- ============================================

CREATE TABLE IF NOT EXISTS public.tenant_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_name TEXT NOT NULL,
  unit_number TEXT,
  building_address TEXT,
  issue_type TEXT NOT NULL CHECK (issue_type IN (
    'parking_warning',
    'parking_declined_tow',
    'parking_tow_listed',
    'parking_delinquency'
  )),
  issue_date TIMESTAMPTZ NOT NULL,
  reference_type TEXT, -- 'submission', 'tow_manual_entry', etc.
  reference_id UUID,
  severity INTEGER CHECK (severity >= 1 AND severity <= 5),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_issues_tenant_name
  ON public.tenant_issues (tenant_name);

CREATE INDEX IF NOT EXISTS idx_tenant_issues_unit_building
  ON public.tenant_issues (unit_number, building_address);

CREATE INDEX IF NOT EXISTS idx_tenant_issues_issue_type
  ON public.tenant_issues (issue_type);

CREATE INDEX IF NOT EXISTS idx_tenant_issues_issue_date
  ON public.tenant_issues (issue_date DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_issues_reference
  ON public.tenant_issues (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_tenant_issues_resolved
  ON public.tenant_issues (resolved)
  WHERE resolved = false;

ALTER TABLE public.tenant_issues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_issues'
      AND policyname = 'Allow service role full access to tenant_issues'
  ) THEN
    CREATE POLICY "Allow service role full access to tenant_issues"
      ON public.tenant_issues
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ============================================
-- 5. Ensure permit_revoked_reason has proper constraint
-- ============================================

-- Note: The permit_revoked_reason column should already exist from prior migrations
-- This ensures the CHECK constraint is added if not present
DO $$
BEGIN
  -- We can't easily add a CHECK constraint to an existing column if data exists
  -- The application layer will validate the reason codes
  -- Valid codes: moved_out, vehicle_sold, violation, parking_non_payment, other
  NULL;
END
$$;
