-- PRD-69: Storage bucket creation migrations (drift remediation)
--
-- Three buckets are referenced from tenant + admin code but have NO existing
-- creation migration in supabase/migrations/:
--   - pbv-signatures   (signature PNG images)
--   - form-submissions (tenant-uploaded documents; default doc bucket)
--   - pbv-applications (e-signed PDFs + HACH-shared docs)
--
-- They were created live by hand on prod (project lieeeqqvshobnqofcdac)
-- alongside the bucket-using code, the same way 'pbv-forms' was — see
-- 20260518000000_pbv_forms_storage_bucket.sql header for that precedent.
-- This migration backfills the creation rows for two purposes:
--   1) Parity:           prod state is reflected in migrations/.
--   2) Fresh-env safety: a new environment (staging clone, DR, local-from-
--                        scratch) provisioned from supabase/migrations/ alone
--                        had pbv-forms but NOT these three → every tenant
--                        upload, signature capture, and signed-PDF read 404'd.
--
-- Re-runnable: every INSERT uses ON CONFLICT (id) DO NOTHING. On the existing
-- prod project (where the buckets already exist) this is a complete no-op.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠ RECONCILE BEFORE APPLY ⚠
--
-- The live-DB verification audit that would have given the authoritative
-- file_size_limit / allowed_mime_types values for each bucket was not
-- available at build time. Per the PRD-69 prompt's "do not invent values"
-- rule, this migration ships with:
--   - public = false (consistent with pbv-forms + signing-packets precedent;
--     all PBV buckets are accessed via the service role)
--   - file_size_limit = NULL (no Postgres-level cap; honor whatever app-side
--     limits already exist in the upload handlers)
--   - allowed_mime_types = NULL (no Postgres-level MIME filter; honor
--     whatever the upload handlers already validate)
--
-- These defaults are SAFE for prod (ON CONFLICT DO NOTHING leaves the existing
-- live values untouched) and PERMISSIVE for fresh environments. Before
-- standing up a brand-new environment for production use, the live values
-- (`select id, public, file_size_limit, allowed_mime_types from
-- storage.buckets where id in ('pbv-signatures','form-submissions',
-- 'pbv-applications')` on prod) MUST be copied in here to lock fresh-env
-- config to prod parity. See docs/fullApp-Plan/OPEN-DECISIONS.md "Prod
-- migrations to apply" → PRD-69 entry for the reconcile checklist.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pbv-signatures',   'pbv-signatures',   false, NULL, NULL),
  ('form-submissions', 'form-submissions', false, NULL, NULL),
  ('pbv-applications', 'pbv-applications', false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Note: RLS policies for storage.objects are intentionally NOT added here.
-- All three buckets are accessed exclusively via the service role from API
-- routes (supabaseAdmin), so no per-bucket public policies are needed —
-- this mirrors the pbv-forms migration's precedent
-- (20260518000000_pbv_forms_storage_bucket.sql lines 16-21).
--
-- If the live-DB audit shows any of these three has CREATE POLICY entries on
-- storage.objects that this migration is missing, add them here modeled on
-- 20260513140000_post_approval_execution_storage.sql (the signing-packets
-- pattern). On prod this is a no-op (policies survive ON CONFLICT DO NOTHING
-- on storage.buckets); on a fresh env it gates access correctly.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
--
-- Buckets created via this migration cannot be deleted while objects exist.
-- For a fresh-env rollback only (no objects):
--   DELETE FROM storage.buckets WHERE id IN
--     ('pbv-signatures','form-submissions','pbv-applications');
-- On prod, never delete these buckets — they hold tenant artifacts.
-- ─────────────────────────────────────────────────────────────────────────────
