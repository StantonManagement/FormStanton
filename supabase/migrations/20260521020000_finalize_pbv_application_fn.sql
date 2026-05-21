-- PRD-64: Atomic finalize for PBV full applications
-- Date: 2026-05-21
--
-- Pre-PRD-64, /api/t/[token]/pbv-full-app/finalize set submitted_at first and
-- then wrote the application.submitted event inside a swallowing try/catch
-- (audit finding #10). On event-insert failure the application was submitted
-- but the audit timeline had no submission row.
--
-- This SECURITY DEFINER function does both writes in one transaction. On any
-- error the RAISE bubbles out and the transaction rolls back, so the app is
-- never left "submitted but un-audited."
--
-- Style mirrors execute_hap_transaction
-- (supabase/migrations/20260513000001_hap_execution_function.sql).
--
-- application_events column shape per
-- supabase/migrations/20260513160000_document_lifecycle_phase1.sql plus the
-- polymorphic anchor in
-- supabase/migrations/20260513200000_application_events_generalize.sql.
--
-- IMPORTANT: This SQL path bypasses the in-process _notifySubscribers hook in
-- lib/events/application-events.ts. application.submitted has no subscriber
-- today, so this is neutral — but logged in OPEN-DECISIONS so a future
-- subscriber for that event isn't silently dropped.
--
-- Status: NOT YET APPLIED — listed in OPEN-DECISIONS for deliberate apply.

CREATE OR REPLACE FUNCTION public.finalize_pbv_application(
  p_app_id              UUID,
  p_submitted_at        TIMESTAMPTZ,
  p_actor_display_name  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Mark the application submitted (idempotent: only writes if not already set).
  UPDATE public.pbv_full_applications
  SET submitted_at = p_submitted_at
  WHERE id = p_app_id
    AND submitted_at IS NULL;

  -- 2. Insert the application.submitted audit event in the same transaction.
  INSERT INTO public.application_events (
    anchor_type,
    anchor_id,
    event_type,
    actor_user_id,
    actor_display_name,
    payload
  ) VALUES (
    'pbv_full_application',
    p_app_id,
    'application.submitted',
    NULL,
    p_actor_display_name,
    jsonb_build_object('submitted_at', p_submitted_at)
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise to force the transaction to roll back. Caller gets the error
    -- and must surface it as a 500; the app stays unsubmitted.
    RAISE;
END;
$$;

-- The service_role connection used by supabaseAdmin is the only caller.
GRANT EXECUTE ON FUNCTION public.finalize_pbv_application(UUID, TIMESTAMPTZ, TEXT) TO service_role;
