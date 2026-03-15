-- Add AppFolio document upload and fee tracking columns

-- Pet Addendum tracking
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS pet_addendum_uploaded_to_appfolio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pet_addendum_uploaded_to_appfolio_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS pet_addendum_uploaded_to_appfolio_by TEXT,
ADD COLUMN IF NOT EXISTS pet_addendum_upload_note TEXT;

-- Vehicle Addendum tracking
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS vehicle_addendum_uploaded_to_appfolio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vehicle_addendum_uploaded_to_appfolio_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS vehicle_addendum_uploaded_to_appfolio_by TEXT,
ADD COLUMN IF NOT EXISTS vehicle_addendum_upload_note TEXT;

-- Insurance Document tracking
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS insurance_uploaded_to_appfolio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS insurance_uploaded_to_appfolio_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS insurance_uploaded_to_appfolio_by TEXT,
ADD COLUMN IF NOT EXISTS insurance_upload_note TEXT;

-- Pet Fee tracking with amount
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS pet_fee_added_to_appfolio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pet_fee_added_to_appfolio_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS pet_fee_added_to_appfolio_by TEXT,
ADD COLUMN IF NOT EXISTS pet_fee_amount NUMERIC(10,2);

-- Permit Fee tracking with amount
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS permit_fee_added_to_appfolio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permit_fee_added_to_appfolio_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS permit_fee_added_to_appfolio_by TEXT,
ADD COLUMN IF NOT EXISTS permit_fee_amount NUMERIC(10,2);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_submissions_appfolio_status
  ON submissions (
    pet_addendum_uploaded_to_appfolio,
    vehicle_addendum_uploaded_to_appfolio,
    insurance_uploaded_to_appfolio,
    pet_fee_added_to_appfolio,
    permit_fee_added_to_appfolio
  );

-- Add comment explaining AppFolio workflow
COMMENT ON COLUMN submissions.pet_addendum_uploaded_to_appfolio IS 
'Tracks whether pet addendum document was uploaded to AppFolio by property management';

COMMENT ON COLUMN submissions.vehicle_addendum_uploaded_to_appfolio IS 
'Tracks whether vehicle addendum document was uploaded to AppFolio by property management';

COMMENT ON COLUMN submissions.insurance_uploaded_to_appfolio IS 
'Tracks whether insurance document was uploaded to AppFolio by property management';

COMMENT ON COLUMN submissions.pet_fee_added_to_appfolio IS 
'Tracks whether pet rent fee was added to tenant account in AppFolio';

COMMENT ON COLUMN submissions.permit_fee_added_to_appfolio IS 
'Tracks whether parking permit fee was added to tenant account in AppFolio';
