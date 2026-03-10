-- Add vehicle export tracking columns to submissions table
ALTER TABLE submissions
ADD COLUMN vehicle_exported BOOLEAN DEFAULT FALSE,
ADD COLUMN vehicle_exported_at TIMESTAMP,
ADD COLUMN vehicle_exported_by TEXT;

-- Create index for filtering by export status
CREATE INDEX idx_submissions_vehicle_exported ON submissions(vehicle_exported);
