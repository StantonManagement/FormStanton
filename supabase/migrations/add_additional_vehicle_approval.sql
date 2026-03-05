-- Add fields for tracking additional vehicle approval status
ALTER TABLE submissions
ADD COLUMN additional_vehicle_approved boolean DEFAULT false,
ADD COLUMN additional_vehicle_approved_at timestamp,
ADD COLUMN additional_vehicle_approved_by text,
ADD COLUMN additional_vehicle_denied boolean DEFAULT false,
ADD COLUMN additional_vehicle_denial_reason text;

-- Add index for querying pending additional vehicle requests
CREATE INDEX idx_additional_vehicles_pending ON submissions 
USING gin (additional_vehicles)
WHERE additional_vehicles IS NOT NULL 
AND additional_vehicle_approved = false 
AND additional_vehicle_denied = false;
