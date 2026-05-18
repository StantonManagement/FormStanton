-- Migration: PBV Docs Upload Reminder v2
-- Updates docs_upload_reminder templates to "count + link only" format
-- Archives old version and creates new version with updated interpolations
-- Part of PRD-43: Tenant Outbound Comms

-- Archive existing docs_upload_reminder templates
UPDATE tenant_notification_templates 
SET active = false, updated_at = NOW()
WHERE notification_type = 'docs_upload_reminder' AND active = true;

-- Insert new v2 templates with count + link only format
INSERT INTO tenant_notification_templates (
  notification_type,
  language,
  body,
  version,
  active,
  created_at,
  updated_at,
  created_by
) VALUES 
  -- English template (canonical)
  (
    'docs_upload_reminder',
    'en',
    'Hi {{tenant_name}} — you still have {{missing_count}} documents to finish your housing application.

Pick up where you left off: {{magic_link}}',
    2,
    true,
    NOW(),
    NOW(),
    'system'
  ),
  
  -- Spanish template
  (
    'docs_upload_reminder',
    'es',
    'Hola {{tenant_name}} — aún te faltan {{missing_count}} documentos para terminar tu solicitud de vivienda.

Continúa donde lo dejaste: {{magic_link}}',
    2,
    true,
    NOW(),
    NOW(),
    'system'
  ),
  
  -- Portuguese template
  (
    'docs_upload_reminder',
    'pt',
    'Olá {{tenant_name}} — você ainda tem {{missing_count}} documentos para finalizar sua solicitação de moradia.

Continue de onde parou: {{magic_link}}',
    2,
    true,
    NOW(),
    NOW(),
    'system'
  );
