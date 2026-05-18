-- PBV Form Generation — Storage bucket for generated/stamped PDFs
-- Creates the pbv-forms bucket used by generate-forms, sign-form, summary-pdf,
-- forms/[id]/preview routes. Bucket was missing on hosted Supabase; created
-- live via Storage Admin API on 2026-05-18 alongside this migration for parity.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pbv-forms',
  'pbv-forms',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS policies for storage.objects are intentionally NOT added here.
-- The pbv-forms bucket is accessed exclusively via the service role from
-- API routes (supabaseAdmin), so no public policies are needed. If the
-- access pattern changes (e.g., signed URLs handed to clients), add
-- equivalent policies modeled on signing-packets in
-- 20260513140000_post_approval_execution_storage.sql.
