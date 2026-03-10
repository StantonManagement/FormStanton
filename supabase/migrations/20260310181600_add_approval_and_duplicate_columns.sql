-- Add columns for additional vehicle approval tracking
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS additional_vehicle_approved boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS additional_vehicle_approved_at timestamp,
ADD COLUMN IF NOT EXISTS additional_vehicle_approved_by text,
ADD COLUMN IF NOT EXISTS additional_vehicle_denied boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS additional_vehicle_denial_reason text;

-- Add columns for duplicate tracking and merging
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES submissions(id),
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS duplicate_group_id UUID;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_additional_vehicles_pending ON submissions 
USING gin (additional_vehicles)
WHERE additional_vehicles IS NOT NULL 
AND additional_vehicle_approved = false 
AND additional_vehicle_denied = false;

CREATE INDEX IF NOT EXISTS idx_submissions_duplicate_group_id ON submissions(duplicate_group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_merged_into ON submissions(merged_into);
