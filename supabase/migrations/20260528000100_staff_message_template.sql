-- Migration: staff_message notification template
-- Passthrough template for free-form staff -> applicant messages. The full
-- message body is composed in the messages API route and passed via the
-- {message_body} interpolation (same pattern as doc_rejected). One row per
-- language so the send pipeline's (notification_type, language) lookup
-- resolves regardless of tenant preferred_language.

INSERT INTO tenant_notification_templates (
  notification_type, language, body, version, active, created_at, updated_at
) VALUES
  ('staff_message', 'en', '{message_body}', 1, true, NOW(), NOW()),
  ('staff_message', 'es', '{message_body}', 1, true, NOW(), NOW()),
  ('staff_message', 'pt', '{message_body}', 1, true, NOW(), NOW())
ON CONFLICT DO NOTHING;
