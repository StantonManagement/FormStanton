-- "Resend to complete missing info" — notification template for the intake-reopen flow.
--
-- Status: COMMIT-ONLY. Do NOT apply from the build environment. Alex / Windsurf
-- applies via Supabase MCP / `db push` (standing DB-apply path; see
-- docs/SHELL-PROTOCOL.md "Migration / database commands").
--
-- Seeds the `pbv_complete_application` template (en/es/pt) used by
-- POST /api/admin/pbv/full-applications/[id]/reopen-intake. When an operator
-- reopens a completed intake so the applicant can fill newly-added fields +
-- their full SSN and sign, this is the SMS that links them back in.
--
-- Interpolation vars: {{tenant_name}}, {{magic_link}} only.
--
-- This template MUST exist in production before the first reopen-intake send, or
-- the send silently no-ops (lib/notifications/send.ts returns failed/template_missing).
-- The seed-presence assertion below mirrors
-- 20260531120000_prd85_notification_template_seed_assertion.sql.

INSERT INTO public.tenant_notification_templates
  (notification_type, language, body, version, active)
VALUES
  (
    'pbv_complete_application',
    'en',
    'Hi {{tenant_name}} — we need a few more details to finish your housing application. Tap your link to complete the remaining questions (including your Social Security number), then review and sign your forms:
{{magic_link}}',
    1,
    true
  ),
  (
    'pbv_complete_application',
    'es',
    'Hola {{tenant_name}} — necesitamos algunos datos más para terminar tu solicitud de vivienda. Toca tu enlace para completar las preguntas restantes (incluyendo tu número de Seguro Social) y luego revisa y firma tus formularios:
{{magic_link}}',
    1,
    true
  ),
  (
    'pbv_complete_application',
    'pt',
    'Olá {{tenant_name}} — precisamos de mais alguns dados para concluir sua solicitação de moradia. Toque no seu link para responder às perguntas restantes (incluindo seu número de Seguro Social) e depois revise e assine seus formulários:
{{magic_link}}',
    1,
    true
  )
ON CONFLICT (notification_type, language, version) DO NOTHING;

-- ── Seed-presence assertion ────────────────────────────────────────────────────
-- Re-run the same gate as 20260531120000: every active notification type must
-- have an active row for each supported language (en/es/pt).
DO $$
DECLARE
  v_gap     RECORD;
  v_missing TEXT := '';
BEGIN
  FOR v_gap IN
    SELECT
      t.notification_type,
      array_to_string(
        ARRAY(
          SELECT lang
          FROM unnest(ARRAY['en', 'es', 'pt']) AS lang
          EXCEPT
          SELECT a.language
          FROM public.tenant_notification_templates a
          WHERE a.notification_type = t.notification_type
            AND a.active
        ),
        ','
      ) AS missing_langs
    FROM (
      SELECT DISTINCT notification_type
      FROM public.tenant_notification_templates
      WHERE active
    ) t
  LOOP
    IF v_gap.missing_langs <> '' THEN
      v_missing := v_missing
        || format('  %s missing: %s', v_gap.notification_type, v_gap.missing_langs)
        || E'\n';
    END IF;
  END LOOP;

  IF v_missing <> '' THEN
    RAISE EXCEPTION
      E'Seed-presence assertion failed — active notification types missing language rows:\n%',
      v_missing;
  END IF;
END $$;
