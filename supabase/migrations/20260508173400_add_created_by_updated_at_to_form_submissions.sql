-- Add missing created_by and updated_at columns to form_submissions
-- These were omitted from the original 20260313122800_create_form_submissions_table.sql

ALTER TABLE public.form_submissions
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.form_submissions SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.form_submissions
  ALTER COLUMN updated_at SET DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_form_submissions_updated_at'
      AND tgrelid = 'public.form_submissions'::regclass
  ) THEN
    CREATE TRIGGER set_form_submissions_updated_at
      BEFORE UPDATE ON public.form_submissions
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END
$$;
