-- Add vehicle addendum file upload metadata tracking
-- This tracks when the digital file was uploaded (separate from physical form receipt)

ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS vehicle_addendum_file_uploaded_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS vehicle_addendum_file_uploaded_by TEXT;

-- Add comment explaining the purpose
COMMENT ON COLUMN submissions.vehicle_addendum_file_uploaded_at IS 
'Timestamp when vehicle addendum file was uploaded to the system (digital file upload tracking)';

COMMENT ON COLUMN submissions.vehicle_addendum_file_uploaded_by IS 
'Name of admin user who uploaded the vehicle addendum file (digital file upload tracking)';
