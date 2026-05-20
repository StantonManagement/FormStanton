-- Add index on phone column for tenant lookup queries
-- Improves performance when searching by phone number

CREATE INDEX IF NOT EXISTS idx_pbv_full_applications_phone 
ON public.pbv_full_applications (phone) 
WHERE phone IS NOT NULL;
