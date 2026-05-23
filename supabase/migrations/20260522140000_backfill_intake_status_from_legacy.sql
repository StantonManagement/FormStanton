-- Backfill: reconcile the two intake-completion sentinels on pbv_full_applications.
-- Date: 2026-05-22
--
-- Context: two columns have meant "tenant finished intake":
--   * intake_submitted_at  — written by the LEGACY single-page intake POST
--                            (app/api/t/[token]/pbv-full-app POST).
--   * intake_status='complete' + intake_completed_at — written by the CANONICAL
--                            sectioned flow (app/api/t/[token]/pbv-full-app/intake/complete),
--                            introduced in 20260515000000_pbv_form_execution_columns.sql.
--
-- The admin list/detail, invite-dedup guard, deferred-reminders cron, token-regen
-- guard and the tenant "expired" check were all reading intake_submitted_at, but
-- the modern flow never set it. Result: every app submitted via the modern flow
-- showed as "Invited / —" in staff views despite a completed tenant submission.
--
-- All readers have now been migrated to the canonical signal (intake_status /
-- intake_completed_at). This migration reconciles existing rows in BOTH directions
-- so historical apps display correctly regardless of which intake path created them.
--
-- Idempotent: each UPDATE is guarded so re-running is a no-op.
--
-- Apply path: NOT runnable from the Cowork sandbox (no psql/CLI/pg; HTTP keys only).
-- Apply via Supabase MCP / `supabase db push` from native Windows.

-- 1. Legacy-path rows: intake_submitted_at set but canonical status not 'complete'.
--    Promote them to the canonical signal so they keep showing as submitted.
UPDATE public.pbv_full_applications
SET intake_status      = 'complete',
    intake_completed_at = COALESCE(intake_completed_at, intake_submitted_at)
WHERE intake_submitted_at IS NOT NULL
  AND intake_status IS DISTINCT FROM 'complete';

-- 2. Canonical-path rows: intake_status='complete' but the legacy timestamp is null.
--    Backfill intake_submitted_at for data hygiene / any external consumer that
--    still references the legacy column.
UPDATE public.pbv_full_applications
SET intake_submitted_at = intake_completed_at
WHERE intake_status = 'complete'
  AND intake_submitted_at IS NULL
  AND intake_completed_at IS NOT NULL;
