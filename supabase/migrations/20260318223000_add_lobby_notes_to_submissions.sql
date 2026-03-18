ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS lobby_notes TEXT,
  ADD COLUMN IF NOT EXISTS lobby_notes_processed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lobby_notes_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lobby_notes_updated_by TEXT;
