-- =============================================================================
-- Workforce Dashboards Migration
-- Adds:
--   1. Permission seed for view_team_rollup
--   2. target_move_in_date column to pbv_full_applications (for at-risk panel)
-- =============================================================================

-- ─── 1. Permission seed for Team Rollup view ─────────────────────────────────
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'view_team_rollup')
ON CONFLICT (resource, action) DO NOTHING;

-- ─── 2. Add target_move_in_date column if not exists ─────────────────────────
-- This column is used by the at-risk panel to identify applications
-- that may miss their move-in commitment
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS target_move_in_date DATE NULL;

-- Index for efficient at-risk queries
CREATE INDEX IF NOT EXISTS idx_pbv_full_apps_target_move_in
  ON public.pbv_full_applications (target_move_in_date)
  WHERE target_move_in_date IS NOT NULL;

-- ─── 3. Comment explaining the column usage ─────────────────────────────────
COMMENT ON COLUMN public.pbv_full_applications.target_move_in_date IS
  'Target move-in date for the tenant. Used by workforce dashboards at-risk panel. Falls back to stage-age if null.';
