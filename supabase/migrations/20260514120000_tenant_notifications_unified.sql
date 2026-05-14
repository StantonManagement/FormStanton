-- ============================================================
-- PRD-04: Tenant Notifications Unified
-- Applied via MCP on 2026-05-14.
-- tenant_notification_templates, notification_schedules,
-- tenant_inbound_messages + pbv_full_applications consent columns
-- ============================================================

-- ── 1. tenant_notification_templates ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_notification_templates (
  notification_type  TEXT        NOT NULL,
  language           TEXT        NOT NULL CHECK (language IN ('en', 'es', 'pt')),
  body               TEXT        NOT NULL,
  version            INTEGER     NOT NULL DEFAULT 1,
  active             BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_type, language, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS tnt_active_per_type_lang
  ON public.tenant_notification_templates (notification_type, language)
  WHERE active = true;

ALTER TABLE public.tenant_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on tenant_notification_templates"
  ON public.tenant_notification_templates FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
  CREATE TRIGGER set_updated_at_tenant_notification_templates
    BEFORE UPDATE ON public.tenant_notification_templates
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 2. notification_schedules ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notification_schedules (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID        NOT NULL
    REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  notification_type  TEXT        NOT NULL,
  due_at             TIMESTAMPTZ NOT NULL,
  cancel_predicate   TEXT,
  status             TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  interpolations     JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at            TIMESTAMPTZ
);

ALTER TABLE public.notification_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on notification_schedules"
  ON public.notification_schedules FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ns_due_pending_idx
  ON public.notification_schedules (due_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS ns_app_idx
  ON public.notification_schedules (application_id);

-- ── 3. tenant_inbound_messages ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenant_inbound_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone          TEXT        NOT NULL,
  body                TEXT        NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  twilio_message_sid  TEXT        UNIQUE,
  matched_keyword     TEXT,
  handled             BOOLEAN     NOT NULL DEFAULT false
);

ALTER TABLE public.tenant_inbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on tenant_inbound_messages"
  ON public.tenant_inbound_messages FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ── 4. pbv_full_applications — consent + opt-out columns ───────────────────────

ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS sms_consent_captured_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_consent_text_version   TEXT,
  ADD COLUMN IF NOT EXISTS sms_opted_out_at           TIMESTAMPTZ;

-- ── 5. TCPA backfill ───────────────────────────────────────────────────────────

UPDATE public.pbv_full_applications
SET
  sms_consent_captured_at  = now(),
  sms_consent_text_version = '2026-05-14-v1'
WHERE phone IS NOT NULL
  AND sms_consent_captured_at IS NULL;

-- ── 6. Seed tenant_notification_templates (21 rows = 7 types × 3 languages) ────

INSERT INTO public.tenant_notification_templates
  (notification_type, language, body, version, active)
VALUES
  ('magic_link_initial', 'en', 'Stanton Management: Your PBV application is ready. Complete your intake and upload documents here: {portal_url}', 1, true),
  ('magic_link_initial', 'es', 'Stanton Management: Su solicitud PBV está lista. Complete su admisión y suba sus documentos aquí: {portal_url}', 1, true),
  ('magic_link_initial', 'pt', 'Stanton Management: Sua solicitação PBV está pronta. Conclua seu cadastro e envie seus documentos aqui: {portal_url}', 1, true),
  ('magic_link_resent', 'en', 'Stanton Management: Here is your updated portal link: {portal_url}', 1, true),
  ('magic_link_resent', 'es', 'Stanton Management: Aquí está su enlace de portal actualizado: {portal_url}', 1, true),
  ('magic_link_resent', 'pt', 'Stanton Management: Aqui está o seu link de portal atualizado: {portal_url}', 1, true),
  ('docs_upload_reminder', 'en', 'Stanton Management: Reminder — your PBV application is still missing documents. Please upload them here: {portal_url}', 1, true),
  ('docs_upload_reminder', 'es', 'Stanton Management: Recordatorio — a su solicitud PBV aún le faltan documentos. Por favor súbalos aquí: {portal_url}', 1, true),
  ('docs_upload_reminder', 'pt', 'Stanton Management: Lembrete — sua solicitação PBV ainda está com documentos faltando. Por favor, envie-os aqui: {portal_url}', 1, true),
  ('doc_rejected', 'en', '{message_body}', 1, true),
  ('doc_rejected', 'es', '{message_body}', 1, true),
  ('doc_rejected', 'pt', '{message_body}', 1, true),
  ('hach_approved_signing_ready', 'en', 'Stanton Management: Great news! Your application has been approved. Please sign your documents here: {portal_url}', 1, true),
  ('hach_approved_signing_ready', 'es', 'Stanton Management: ¡Buenas noticias! Su solicitud ha sido aprobada. Por favor firme sus documentos aquí: {portal_url}', 1, true),
  ('hach_approved_signing_ready', 'pt', 'Stanton Management: Ótimas notícias! Sua solicitação foi aprovada. Por favor, assine seus documentos aqui: {portal_url}', 1, true),
  ('signing_reminder', 'en', 'Stanton Management: Reminder — your signing documents are waiting. Please complete them here: {portal_url}', 1, true),
  ('signing_reminder', 'es', 'Stanton Management: Recordatorio — sus documentos para firmar están esperando. Por favor complétalos aquí: {portal_url}', 1, true),
  ('signing_reminder', 'pt', 'Stanton Management: Lembrete — seus documentos para assinatura estão aguardando. Por favor, conclua-os aqui: {portal_url}', 1, true),
  ('hap_executed_move_in', 'en', 'Stanton Management: Congratulations! Your HAP contract has been executed. Welcome — please contact your property manager to schedule move-in.', 1, true),
  ('hap_executed_move_in', 'es', 'Stanton Management: ¡Felicidades! Su contrato HAP ha sido ejecutado. Bienvenido — por favor contacte a su administrador de propiedad para programar su mudanza.', 1, true),
  ('hap_executed_move_in', 'pt', 'Stanton Management: Parabéns! Seu contrato HAP foi executado. Bem-vindo — por favor, entre em contato com o seu gestor de propriedade para agendar a mudança.', 1, true)
ON CONFLICT (notification_type, language, version) DO NOTHING;
