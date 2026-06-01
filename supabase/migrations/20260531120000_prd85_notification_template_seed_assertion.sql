-- PRD-85 Phase 2 — notification template idempotent reseed + seed-presence assertion.
--
-- Status: COMMIT-ONLY. Do NOT apply from the build environment. Alex / Windsurf
-- applies via Supabase MCP / `db push` (standing DB-apply path; see
-- docs/SHELL-PROTOCOL.md "Migration / database commands").
--
-- Root cause (PRD-85): the intake→signing handoff (`pbv_preflight_checklist`)
-- depends on a notification template row that did not exist in production until
-- 2026-05-29. A missing row surfaced only as a per-applicant silent runtime miss.
-- This migration closes that gap two ways:
--   (a) idempotently (re)seeds the live-trigger handoff template for en/es/pt so a
--       fresh DB built purely from migrations always has it; and
--   (b) asserts every active=true notification type has an active row for each
--       supported language (en/es/pt), failing the migration loudly otherwise.
--
-- The TypeScript mirror of the (b) assertion lives in
-- lib/notifications/seedAssertion.ts (unit-tested). Keep them in lockstep.

-- ── (a) Idempotent reseed of the live-trigger handoff template ─────────────────
-- ON CONFLICT DO NOTHING: inserts the canonical (notification_type, language,
-- version=1) rows when absent and leaves an existing active row untouched. The
-- partial unique index tnt_active_per_type_lang guarantees one active row per
-- (type, language); we do not flip versions here.
INSERT INTO public.tenant_notification_templates
  (notification_type, language, body, version, active)
VALUES
  (
    'pbv_preflight_checklist',
    'en',
    'Hi {{tenant_name}} — to finish your housing application, gather these:

{{doc_list}}

When you have them, tap your link:
{{magic_link}}',
    1,
    true
  ),
  (
    'pbv_preflight_checklist',
    'es',
    'Hola {{tenant_name}} — para terminar tu solicitud de vivienda, reúne estos documentos:

{{doc_list}}

Cuando los tengas, toca tu enlace:
{{magic_link}}',
    1,
    true
  ),
  (
    'pbv_preflight_checklist',
    'pt',
    'Olá {{tenant_name}} — para finalizar sua solicitação de moradia, reúna estes documentos:

{{doc_list}}

Quando os tiver, toque no seu link:
{{magic_link}}',
    1,
    true
  )
ON CONFLICT (notification_type, language, version) DO NOTHING;

-- ── (b) Seed-presence assertion ────────────────────────────────────────────────
-- For every notification type that has at least one active row, require an active
-- row for each supported language. Raise (and abort the migration) on any gap.
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
      E'PRD-85 seed-presence assertion failed — active notification types missing language rows:\n%',
      v_missing;
  END IF;
END $$;
