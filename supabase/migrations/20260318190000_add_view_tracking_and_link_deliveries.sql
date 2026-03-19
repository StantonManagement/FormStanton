-- Add view tracking columns to project_units
ALTER TABLE public.project_units
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INT NOT NULL DEFAULT 0;

-- Drop unused twilio_delivery_status column
ALTER TABLE public.project_units
  DROP COLUMN IF EXISTS twilio_delivery_status;

-- Create link_deliveries table (one row per send attempt — immutable audit trail)
CREATE TABLE IF NOT EXISTS public.link_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_unit_id UUID NOT NULL REFERENCES public.project_units(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('sms', 'email')),
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by TEXT NOT NULL,
  send_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.link_deliveries ENABLE ROW LEVEL SECURITY;

-- Index for lookups by project_unit
CREATE INDEX IF NOT EXISTS idx_link_deliveries_project_unit_id ON public.link_deliveries(project_unit_id);
