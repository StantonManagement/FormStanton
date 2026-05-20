-- PRD-53: Add email and qualification override columns to pbv_preapplications

-- Add email column
ALTER TABLE pbv_preapplications 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add qualification override tracking columns
ALTER TABLE pbv_preapplications 
ADD COLUMN IF NOT EXISTS qualification_override_reason TEXT,
ADD COLUMN IF NOT EXISTS qualification_override_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qualification_override_by TEXT;
