-- Build 1: rejection_reason_templates table + seed + reason_code on document_review_actions
-- Applied live via MCP on 2026-04-24. This file is the migration record.
-- Idempotent throughout.

CREATE TABLE IF NOT EXISTS public.rejection_reason_templates (
  code        TEXT        PRIMARY KEY,
  label       TEXT        NOT NULL,
  template_en TEXT        NOT NULL,
  template_es TEXT        NOT NULL,
  template_pt TEXT        NOT NULL,
  sort_order  INT         DEFAULT 100,
  is_active   BOOLEAN     DEFAULT TRUE,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID        REFERENCES public.admin_users(id)
);

ALTER TABLE public.rejection_reason_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on rejection_reason_templates"
  ON public.rejection_reason_templates
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

INSERT INTO public.rejection_reason_templates
  (code, label, template_en, template_es, template_pt, sort_order)
VALUES
  ('stale','Document expired or older than 60 days',
   'Hi {tenant}, the {doc} you uploaded is older than 60 days. Please upload your most recent {doc_short}.',
   'Hola {tenant}, el documento {doc} que subió tiene más de 60 días. Por favor suba su {doc_short} más reciente.',
   'Olá {tenant}, o documento {doc} que você enviou tem mais de 60 dias. Por favor, envie seu {doc_short} mais recente.',
   10),
  ('illegible','Illegible / blurry',
   'Hi {tenant}, the {doc} is too blurry to read. Please re-upload a clear photo or scan.',
   'Hola {tenant}, el {doc} está muy borroso para leer. Por favor suba una foto clara o escaneo.',
   'Olá {tenant}, o {doc} está muy borrado para ler. Por favor, envie uma foto clara ou digitalização.',
   20),
  ('wrong_member','Wrong household member',
   'Hi {tenant}, the {doc} is for the wrong person. Please upload the document for the correct household member.',
   'Hola {tenant}, el {doc} corresponde a la persona equivocada. Por favor suba el documento del miembro correcto del hogar.',
   'Olá {tenant}, o {doc} é para a pessoa errada. Por favor, envie o documento do membro correto da família.',
   30),
  ('missing_pages','Missing pages',
   'Hi {tenant}, the {doc} is missing pages. Please upload the complete document.',
   'Hola {tenant}, le faltan páginas al {doc}. Por favor suba el documento completo.',
   'Olá {tenant}, o {doc} está incompleto. Por favor, envie o documento completo.',
   40),
  ('wrong_doc','Not the document requested',
   'Hi {tenant}, this isn''t the {doc} we need. Please review and upload the correct document.',
   'Hola {tenant}, esto no es el {doc} que necesitamos. Por favor revise y suba el documento correcto.',
   'Olá {tenant}, este não é o {doc} que precisamos. Por favor, verifique e envie o documento correto.',
   50),
  ('insufficient','Insufficient — needs more data',
   'Hi {tenant}, we need additional {doc_short} to complete review. Please upload more recent records.',
   'Hola {tenant}, necesitamos {doc_short} adicional para completar la revisión. Por favor suba registros más recientes.',
   'Olá {tenant}, precisamos de {doc_short} adicional para concluir a análise. Por favor, envie registros mais recentes.',
   60),
  ('other','Other',
   'Hi {tenant}, please re-submit your {doc}. Reason: {custom}',
   'Hola {tenant}, por favor reenvíe su {doc}. Motivo: {custom}',
   'Olá {tenant}, por favor reenvie seu {doc}. Motivo: {custom}',
   70)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS reason_code TEXT REFERENCES public.rejection_reason_templates(code);

CREATE TABLE IF NOT EXISTS public.tenant_notifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  document_id         UUID        REFERENCES public.form_submission_documents(id) ON DELETE SET NULL,
  triggered_by        TEXT        NOT NULL,
  channel             TEXT        NOT NULL,
  recipient           TEXT        NOT NULL,
  language            TEXT        NOT NULL,
  message             TEXT        NOT NULL,
  provider_message_id TEXT,
  delivery_status     TEXT        DEFAULT 'queued',
  error_detail        TEXT,
  sent_at             TIMESTAMPTZ DEFAULT NOW(),
  delivered_at        TIMESTAMPTZ,
  UNIQUE(provider_message_id)
);

ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on tenant_notifications"
  ON public.tenant_notifications
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS tn_app_idx ON public.tenant_notifications(application_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS tn_doc_idx ON public.tenant_notifications(document_id, sent_at DESC);

ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES public.tenant_notifications(id);
