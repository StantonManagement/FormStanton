-- PRD-36: Tenant-Facing Application Status
-- Adds application_review_status columns with backfill

ALTER TABLE pbv_full_applications
  ADD COLUMN application_review_status      TEXT         NULL,
  ADD COLUMN application_review_status_at   TIMESTAMPTZ  NULL,
  ADD COLUMN application_review_status_note TEXT         NULL;

-- Add CHECK constraint for status taxonomy
ALTER TABLE pbv_full_applications
  ADD CONSTRAINT check_application_review_status 
  CHECK (application_review_status IS NULL OR 
         application_review_status IN ('submitted', 'under_review', 'action_required', 'approved', 'denied', 'archived'));

-- Backfill: every completed application starts as 'submitted'
UPDATE pbv_full_applications
   SET application_review_status = 'submitted',
       application_review_status_at = COALESCE(submitted_at, NOW())
 WHERE intake_status = 'complete'
   AND application_review_status IS NULL;
