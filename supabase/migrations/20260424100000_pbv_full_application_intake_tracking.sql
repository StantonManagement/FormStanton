-- Add intake_submitted_at to pbv_full_applications
-- Populated by the tenant-facing POST handler when intake form is submitted.

ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS intake_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pbv_full_applications.intake_submitted_at IS
  'Timestamp when the tenant completed and submitted the intake form. '
  'NULL means the invitation has been sent but intake has not been started or completed.';
