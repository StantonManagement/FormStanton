-- PRD-72: Portuguese Form Display-Name Parity — Backfill
-- Date: 2026-05-21
--
-- Backfills display_name_pt for every pbv_form_templates row. Until this is
-- applied, tenants with preferred_language='pt' see English names on the
-- HOH forms list and on the member-token signer page (PRD-72 finding #5).
--
-- These translations are BEST-EFFORT (per PRD-72 O1 / PRD-59 posture):
-- machine + Cowork-drafted, intended to ship for launch and be reviewed by
-- a native Portuguese speaker post-launch. Every value below is also listed
-- in docs/fullApp-Plan/OPEN-DECISIONS.md (#PRD-72) so the review can happen
-- against a single artifact, not by grepping migrations.
--
-- The route fallback chain (pt → en → form_id) means: if a row's _pt is
-- ever cleared, tenants see English again rather than form_id slugs.
--
-- Idempotent: each UPDATE targets a specific form_id and rewrites _pt
-- unconditionally. Safe to re-run.
--
-- briefing_cert / briefing_docs_certification: PRD-55 renamed
-- briefing_docs_certification → briefing_cert. This backfill updates BOTH
-- ids so it works whether PRD-55 has been applied to the target env or not.

UPDATE public.pbv_form_templates
SET display_name_pt = 'Pedido HCV de Ocupação Continuada'
WHERE form_id = 'main_application';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Declaração de Cidadania'
WHERE form_id = 'citizenship_declaration';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Obrigações da Família'
WHERE form_id = 'obligations_of_family';

UPDATE public.pbv_form_templates
SET display_name_pt = 'HUD-9886-A Autorização para Divulgação de Informações'
WHERE form_id = 'hud_9886a';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Autorização HACH para Divulgação de Informações'
WHERE form_id = 'hach_release';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Formulário de Contato Suplementar HUD-92006'
WHERE form_id = 'hud_92006';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Declaração Juramentada de Pensão Alimentícia'
WHERE form_id = 'child_support_affidavit';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Declaração Juramentada de Ausência de Pensão Alimentícia'
WHERE form_id = 'no_child_support_affidavit';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Adendo de Animais de Estimação'
WHERE form_id = 'pet_addendum';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Adendo de Veículo'
WHERE form_id = 'vehicle_addendum';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Planilha de Renda de Trabalho Autônomo'
WHERE form_id = 'self_employment_worksheet';

-- Pre- and post-PRD-55 form_id both handled.
UPDATE public.pbv_form_templates
SET display_name_pt = 'Certificação Familiar de Recebimento de Documentos de Orientação'
WHERE form_id IN ('briefing_cert', 'briefing_docs_certification');

UPDATE public.pbv_form_templates
SET display_name_pt = 'Dívidas com Autoridades de Habitação (HUD-52675)'
WHERE form_id = 'debts_owed_phas';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Certificação VAWA (HUD-5382)'
WHERE form_id = 'vawa_certification';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Pedido de Adaptação Razoável'
WHERE form_id = 'reasonable_accommodation_request';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Declaração de Renda Zero'
WHERE form_id = 'zero_income_statement';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Recibo do Guia EIV'
WHERE form_id = 'eiv_guide_receipt';

UPDATE public.pbv_form_templates
SET display_name_pt = 'Autorização de Antecedentes Criminais'
WHERE form_id = 'criminal_background_release';

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification (run manually after applying):
--   SELECT form_id, display_name_pt FROM public.pbv_form_templates
--   WHERE display_name_pt IS NULL;       -- expect 0 rows (modulo unseeded ids)
--   SELECT COUNT(*) FROM public.pbv_form_templates
--   WHERE display_name_pt IS NOT NULL;   -- expect 18 (17 seeded + criminal_background_release)
-- ─────────────────────────────────────────────────────────────────────────────
