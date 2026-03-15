ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS insurance_authorization_signature TEXT,
  ADD COLUMN IF NOT EXISTS insurance_authorization_signature_date DATE,
  ADD COLUMN IF NOT EXISTS pickup_id_photo TEXT,
  ADD COLUMN IF NOT EXISTS pickup_id_photo_at TIMESTAMP;
