-- Add columns for duplicate tracking and merging
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES submissions(id),
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS duplicate_group_id UUID;

-- Create index on duplicate_group_id for performance
CREATE INDEX IF NOT EXISTS idx_submissions_duplicate_group_id ON submissions(duplicate_group_id);

-- Create index on merged_into for filtering
CREATE INDEX IF NOT EXISTS idx_submissions_merged_into ON submissions(merged_into);

-- Add comment explaining the columns
COMMENT ON COLUMN submissions.merged_into IS 'If this submission was merged into another, this references the primary submission ID';
COMMENT ON COLUMN submissions.is_primary IS 'Whether this submission is the primary record in a duplicate group';
COMMENT ON COLUMN submissions.duplicate_group_id IS 'UUID grouping duplicate submissions together';
