-- Migration: pbv_application_messages
-- Two-way staff <-> applicant messaging thread for a PBV full application.
--   * outbound rows: staff/system messages sent to the tenant (SMS), with
--     twilio_message_sid + delivery_status populated after send.
--   * inbound rows: tenant SMS replies, written by the Twilio inbound webhook
--     after resolving the sender phone to an application.
-- related_document_ids links a "request changes" message to the documents the
-- applicant was asked to fix, so the thread shows exactly what was requested.
--
-- RLS: service-role-only (matches tenant_notifications / pbv_form_documents).
-- All staff access goes through API routes using the service-role client; the
-- Twilio webhook also uses the service-role client. No anon/authenticated
-- direct access.

CREATE TABLE IF NOT EXISTS pbv_application_messages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id   uuid NOT NULL REFERENCES pbv_full_applications(id) ON DELETE CASCADE,
  direction             text NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  channel               text NOT NULL DEFAULT 'sms',
  body                  text NOT NULL,
  sender_role           text NOT NULL CHECK (sender_role IN ('staff', 'tenant', 'system')),
  sender_user_id        uuid,
  sender_display_name   text,
  related_document_ids  uuid[],
  twilio_message_sid    text,
  delivery_status       text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text
);

CREATE INDEX IF NOT EXISTS idx_pbv_application_messages_app_created
  ON pbv_application_messages (full_application_id, created_at);

DROP TRIGGER IF EXISTS set_updated_at_pbv_application_messages ON pbv_application_messages;
CREATE TRIGGER set_updated_at_pbv_application_messages
  BEFORE UPDATE ON pbv_application_messages
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE pbv_application_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access on pbv_application_messages" ON pbv_application_messages;
CREATE POLICY "service_role full access on pbv_application_messages"
  ON pbv_application_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE pbv_application_messages IS
  'Two-way staff<->applicant SMS thread per PBV full application. Service-role-only RLS; staff access via API routes, inbound via Twilio webhook.';
