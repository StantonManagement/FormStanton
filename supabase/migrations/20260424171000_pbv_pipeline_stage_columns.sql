-- Build 2: stanton-pipeline-dashboard Phase 1 schema
-- Applied live via MCP on 2026-04-24. This file is the migration record.
-- Idempotent throughout.

ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS stage             TEXT,
  ADD COLUMN IF NOT EXISTS stage_changed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_to       UUID REFERENCES public.admin_users(id);

DO $$ BEGIN
  ALTER TABLE public.pbv_full_applications
    ADD CONSTRAINT pbv_stage_check CHECK (stage IN (
      'pre_app', 'intake', 'stanton_review', 'submitted_to_hach',
      'hach_review', 'approved', 'denied', 'withdrawn'
    ));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS pbv_stage_idx
  ON public.pbv_full_applications(stage, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS pbv_assigned_idx
  ON public.pbv_full_applications(assigned_to, last_activity_at DESC);

-- Backfill: see MCP migration for logic details.
-- stage_changed_at = created_at (no historical transition timestamps available)
-- last_activity_at = greatest(created_at, last doc revision, last review action)
