ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS insurance_type TEXT
    CHECK (insurance_type IN ('renters', 'car', 'other')),
  ADD COLUMN IF NOT EXISTS pet_addendum_received BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_addendum_received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS pet_addendum_received_by TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_addendum_received BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_addendum_received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS vehicle_addendum_received_by TEXT;
