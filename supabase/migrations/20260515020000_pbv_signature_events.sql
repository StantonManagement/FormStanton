-- PRD-24: pbv_signature_events
-- One row per (signer × form × signing-ceremony tap).
-- Form-execution-specific; parallel to signature_capture_audit (which serves post-approval signing).
-- Apply after: 20260515010000_pbv_form_documents.sql

CREATE TABLE IF NOT EXISTS public.pbv_signature_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_document_id      UUID        NOT NULL
    REFERENCES public.pbv_form_documents(id) ON DELETE CASCADE,
  signer_member_id      UUID        NOT NULL
    REFERENCES public.pbv_household_members(id) ON DELETE CASCADE,
  signature_image_path  TEXT        NOT NULL,
  typed_name            TEXT        NOT NULL,
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            TEXT,
  user_agent            TEXT,
  device_owner          TEXT        NOT NULL DEFAULT 'self'
    CHECK (device_owner IN ('self', 'hoh_device', 'staff_assisted')),
  document_hash         TEXT        NOT NULL,
  ceremony_id           UUID,
  consent_text_version  TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT one_event_per_signer_per_form
    UNIQUE (form_document_id, signer_member_id)
);

CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_form
  ON public.pbv_signature_events (form_document_id);

CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_signer
  ON public.pbv_signature_events (signer_member_id);

CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_ceremony
  ON public.pbv_signature_events (ceremony_id)
  WHERE ceremony_id IS NOT NULL;

ALTER TABLE public.pbv_signature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_signature_events"
  ON public.pbv_signature_events
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.pbv_signature_events IS
  'Audit trail for PBV form-execution signatures. One row per (signer × form × ceremony tap). '
  'Distinct from signature_capture_audit (post-approval signing for lease/HAP). '
  'ceremony_id groups all per-form taps within the same physical signing session. '
  'document_hash captures SHA-256 of the form PDF state at the moment of signing.';

COMMENT ON COLUMN public.pbv_signature_events.signature_image_path IS
  'Storage path to the signature image PNG. Same image reused across all per-form taps '
  'within one ceremony — captured once at signature/capture, referenced by every sign-form call.';

COMMENT ON COLUMN public.pbv_signature_events.consent_text_version IS
  'Version string of the consent disclosure text shown before tapping to confirm. '
  'Required for HACH audit trail. Set by the sign-form caller.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- DROP TABLE IF EXISTS public.pbv_signature_events CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────
