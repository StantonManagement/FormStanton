-- Add workflow status tracking fields to form_submissions table

-- Add status column with CHECK constraint
ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending_review'
CHECK (status IN (
  'pending_review',
  'under_review',
  'approved',
  'denied',
  'revision_requested',
  'sent_to_appfolio',
  'completed'
));

-- Add assignment and priority tracking
ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS assigned_to TEXT;

ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
CHECK (priority IN ('low', 'medium', 'high'));

-- Add status history tracking (JSONB array of status changes)
ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Add denial and revision tracking
ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS denial_reason TEXT;

ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS revision_notes TEXT;

-- Add Appfolio export tracking
ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS sent_to_appfolio_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.form_submissions
ADD COLUMN IF NOT EXISTS sent_to_appfolio_by TEXT;

-- Backfill existing submissions to pending_review status
UPDATE public.form_submissions
SET status = 'pending_review'
WHERE status IS NULL;

-- Create indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_form_submissions_status
  ON public.form_submissions (status);

CREATE INDEX IF NOT EXISTS idx_form_submissions_assigned_to
  ON public.form_submissions (assigned_to);

CREATE INDEX IF NOT EXISTS idx_form_submissions_priority
  ON public.form_submissions (priority);

CREATE INDEX IF NOT EXISTS idx_form_submissions_building_status
  ON public.form_submissions (building_address, status);

-- Add comment explaining the status flow
COMMENT ON COLUMN public.form_submissions.status IS 
'Workflow status: pending_review -> under_review -> approved/denied/revision_requested -> sent_to_appfolio -> completed';
