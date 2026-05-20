-- Migration: PRD-34 Intake Data Snapshot Pattern + Schema Cleanup
-- Adds immutable snapshot column, resume_section as real column, and trigger protection

-- Step 1: Add new columns to pbv_full_applications
ALTER TABLE pbv_full_applications
  ADD COLUMN IF NOT EXISTS intake_snapshot      JSONB        NULL,
  ADD COLUMN IF NOT EXISTS intake_snapshot_at   TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS resume_section       TEXT         NULL;

-- Step 2: Create immutability trigger function
-- Once intake_snapshot is set, it can never be changed (belt-and-suspenders with app code)
CREATE OR REPLACE FUNCTION pbv_intake_snapshot_immutable()
RETURNS trigger AS $$
BEGIN
  IF OLD.intake_snapshot IS NOT NULL AND NEW.intake_snapshot IS DISTINCT FROM OLD.intake_snapshot THEN
    RAISE EXCEPTION 'intake_snapshot is immutable once set (application_id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the trigger
DROP TRIGGER IF EXISTS pbv_full_applications_snapshot_immutable ON pbv_full_applications;

CREATE TRIGGER pbv_full_applications_snapshot_immutable
  BEFORE UPDATE ON pbv_full_applications
  FOR EACH ROW
  EXECUTE FUNCTION pbv_intake_snapshot_immutable();

-- Step 4: Backfill resume_section from existing JSONB data
UPDATE pbv_full_applications
   SET resume_section = intake_data->>'_resume_section'
 WHERE intake_data ? '_resume_section'
   AND resume_section IS NULL;

-- Add comment documenting the column semantics
COMMENT ON COLUMN pbv_full_applications.intake_data IS 'Mutable workspace JSONB during intake. Cleared to {} after /intake/complete.';
COMMENT ON COLUMN pbv_full_applications.intake_snapshot IS 'Immutable legal artifact written once at /intake/complete. Never updated after.';
COMMENT ON COLUMN pbv_full_applications.intake_snapshot_at IS 'Timestamp when intake_snapshot was written.';
COMMENT ON COLUMN pbv_full_applications.resume_section IS 'Tracks last section saved for resume functionality. Previously stored in intake_data._resume_section.';
