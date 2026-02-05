-- Add insurance_upload_pending field to submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS insurance_upload_pending boolean DEFAULT false;

-- Add update policy for returning users to update their insurance
CREATE POLICY IF NOT EXISTS "Allow public updates for insurance"
ON submissions FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
