-- Post-Approval Execution — Storage bucket for signing packets
-- Creates the signing-packets bucket with RLS policies

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signing-packets',
  'signing-packets',
  false,  -- not public, requires signed URL or auth
  10485760,  -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload to their own application paths
CREATE POLICY "Allow authenticated uploads to signing-packets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signing-packets'
  AND (storage.foldername(name))[1] IS NOT NULL  -- Must have application_id as first folder
);

-- Policy: Allow authenticated users to read from signing-packets
CREATE POLICY "Allow authenticated reads from signing-packets"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'signing-packets');

-- Policy: Allow service role full access
CREATE POLICY "Allow service role full access to signing-packets"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'signing-packets')
WITH CHECK (bucket_id = 'signing-packets');
