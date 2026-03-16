-- Add insurance expiration date and item-specific notes columns
-- Migration created: 2026-03-16

-- Add insurance expiration date field
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS insurance_expiration_date DATE;

-- Add item-specific notes columns
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS vehicle_notes TEXT;

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS pet_notes TEXT;

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS insurance_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN submissions.insurance_expiration_date IS 'Expiration date of tenant insurance policy';
COMMENT ON COLUMN submissions.vehicle_notes IS 'Admin notes specific to vehicle compliance items';
COMMENT ON COLUMN submissions.pet_notes IS 'Admin notes specific to pet compliance items';
COMMENT ON COLUMN submissions.insurance_notes IS 'Admin notes specific to insurance compliance items';
