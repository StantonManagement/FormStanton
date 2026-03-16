-- Ensure vehicle_exported columns exist on submissions (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'vehicle_exported'
  ) THEN
    ALTER TABLE submissions ADD COLUMN vehicle_exported BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'vehicle_exported_at'
  ) THEN
    ALTER TABLE submissions ADD COLUMN vehicle_exported_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'submissions' AND column_name = 'vehicle_exported_by'
  ) THEN
    ALTER TABLE submissions ADD COLUMN vehicle_exported_by TEXT;
  END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_submissions_vehicle_exported ON submissions(vehicle_exported);

-- Create vehicle_export_logs table
CREATE TABLE IF NOT EXISTS vehicle_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_by TEXT NOT NULL,
  building_addresses JSONB NOT NULL DEFAULT '[]',
  submission_ids JSONB NOT NULL DEFAULT '[]',
  submission_count INTEGER NOT NULL DEFAULT 0,
  filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE vehicle_export_logs ENABLE ROW LEVEL SECURITY;

-- Index for querying recent exports
CREATE INDEX IF NOT EXISTS idx_vehicle_export_logs_exported_at ON vehicle_export_logs(exported_at DESC);
