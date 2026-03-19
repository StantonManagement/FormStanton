-- Add AppFolio tracking columns for ESA documentation on submissions
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS esa_doc_uploaded_to_appfolio BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS esa_doc_uploaded_to_appfolio_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS esa_doc_uploaded_to_appfolio_by TEXT;

-- Include ESA doc tracking in the existing AppFolio status index
CREATE INDEX IF NOT EXISTS idx_submissions_appfolio_status_esa
  ON public.submissions (
    pet_addendum_uploaded_to_appfolio,
    vehicle_addendum_uploaded_to_appfolio,
    insurance_uploaded_to_appfolio,
    esa_doc_uploaded_to_appfolio,
    pet_fee_added_to_appfolio,
    permit_fee_added_to_appfolio
  );

COMMENT ON COLUMN public.submissions.esa_doc_uploaded_to_appfolio IS
'Tracks whether ESA exemption documentation was uploaded to AppFolio by property management';
