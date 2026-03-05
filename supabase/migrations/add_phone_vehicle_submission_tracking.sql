-- Add fields for tracking phone-submitted vehicle information
ALTER TABLE submissions
ADD COLUMN vehicle_submitted_by_phone boolean DEFAULT false,
ADD COLUMN vehicle_phone_submission_date timestamp,
ADD COLUMN vehicle_phone_submission_by text;

-- Create index for querying phone vehicle submissions
CREATE INDEX idx_phone_vehicle_submissions 
ON submissions (vehicle_submitted_by_phone)
WHERE vehicle_submitted_by_phone = true;
