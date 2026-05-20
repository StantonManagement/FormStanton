-- Migration: PBV Pre-flight Checklist Template
-- Adds notification templates for the new pbv_preflight_checklist notification type
-- Part of PRD-43: Tenant Outbound Comms

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
    'pbv_preflight_checklist',
    'en',
    'Hi {{tenant_name}} — to finish your housing application, gather these:

{{doc_list}}

When you have them, tap your link:
{{magic_link}}',
    1,
    true,
    NOW(),
    NOW(),
    'system'
  ),
  
  -- Spanish template
  (
    'pbv_preflight_checklist',
    'es',
    'Hola {{tenant_name}} — para terminar tu solicitud de vivienda, reúne estos documentos:

{{doc_list}}

Cuando los tengas, toca tu enlace:
{{magic_link}}',
    1,
    true,
    NOW(),
    NOW(),
    'system'
  ),
  
  -- Portuguese template
  (
    'pbv_preflight_checklist',
    'pt',
    'Olá {{tenant_name}} — para finalizar sua solicitação de moradia, reúna estes documentos:

{{doc_list}}

Quando os tiver, toque no seu link:
{{magic_link}}',
    1,
    true,
    NOW(),
    NOW(),
    'system'
  );
