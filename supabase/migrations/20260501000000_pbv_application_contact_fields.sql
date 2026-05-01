-- ============================================================
-- Phase 1.1 — Extend pbv_full_applications with contact fields
-- ============================================================

ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS language_confirmed_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.pbv_full_applications
    ADD CONSTRAINT pbv_preferred_language_check
      CHECK (preferred_language IN ('en', 'es', 'pt'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_pbv_full_app_preferred_language
  ON public.pbv_full_applications (preferred_language);

-- ============================================================
-- Phase 1.2 — Rebuild tenant_notifications with correct schema
-- (Table exists but column names are wrong; no rows ever written)
-- ============================================================

-- Drop FK in document_review_actions first
ALTER TABLE public.document_review_actions
  DROP COLUMN IF EXISTS notification_id;

-- Drop and recreate with correct schema
DROP TABLE IF EXISTS public.tenant_notifications;

CREATE TABLE public.tenant_notifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL
    REFERENCES public.pbv_full_applications(id) ON DELETE RESTRICT,
  document_id         UUID
    REFERENCES public.form_submission_documents(id) ON DELETE SET NULL,
  notification_type   TEXT        NOT NULL,
  language            TEXT        NOT NULL
    CHECK (language IN ('en', 'es', 'pt')),
  recipient_phone     TEXT        NOT NULL,
  message_body        TEXT        NOT NULL,
  template_code       TEXT
    REFERENCES public.rejection_reason_templates(code),
  twilio_message_sid  TEXT,
  delivery_status     TEXT        NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN (
      'pending', 'queued', 'sent', 'delivered', 'failed',
      'blocked_missing_data', 'blocked_invalid_phone'
    )),
  delivery_error      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ
);

ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on tenant_notifications"
  ON public.tenant_notifications FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS tn_app_created_idx
  ON public.tenant_notifications (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tn_status_idx
  ON public.tenant_notifications (delivery_status);

CREATE INDEX IF NOT EXISTS tn_sid_idx
  ON public.tenant_notifications (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

-- Restore FK link in document_review_actions
ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS notification_id UUID
    REFERENCES public.tenant_notifications(id);

-- ============================================================
-- Phase 1.3 — appfolio_update_queue view
-- Surfaces pbv_full_applications contact diffs vs tenant_lookup
-- ============================================================

CREATE OR REPLACE VIEW public.appfolio_update_queue AS

  -- Phone diffs: tenant provided PBV phone that differs from AppFolio
  SELECT
    pfa.id                        AS application_id,
    pfa.head_of_household_name    AS tenant_name,
    pfa.building_address          AS building,
    pfa.unit_number               AS unit,
    'phone'::TEXT                 AS field_name,
    tl.phone                      AS appfolio_value,
    pfa.phone                     AS pbv_value,
    pfa.language_confirmed_at     AS confirmed_at
  FROM public.pbv_full_applications pfa
  JOIN public.tenant_lookup tl
    ON tl.building_address = pfa.building_address
    AND tl.unit_number     = pfa.unit_number
    AND tl.is_current      = true
  WHERE pfa.phone IS NOT NULL
    AND (tl.phone IS NULL OR tl.phone <> pfa.phone)

UNION ALL

  -- Language diffs: tenant confirmed a language that differs from AppFolio
  SELECT
    pfa.id,
    pfa.head_of_household_name,
    pfa.building_address,
    pfa.unit_number,
    'preferred_language'::TEXT,
    tl.preferred_language,
    pfa.preferred_language,
    pfa.language_confirmed_at
  FROM public.pbv_full_applications pfa
  JOIN public.tenant_lookup tl
    ON tl.building_address = pfa.building_address
    AND tl.unit_number     = pfa.unit_number
    AND tl.is_current      = true
  WHERE pfa.preferred_language IS NOT NULL
    AND pfa.language_confirmed_at IS NOT NULL
    AND (tl.preferred_language IS NULL
      OR tl.preferred_language <> pfa.preferred_language);
