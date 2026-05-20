-- PRD-24: pbv_form_templates
-- Form-execution-specific metadata: one row per form_id.
-- Separate from form_document_templates (upload-slot seeding, different concern).
-- Apply after: 20260515030000_pbv_summary_documents.sql
--
-- generation_enabled: FALSE = form skipped at generate-forms time.
-- Source-pending forms (vawa, reasonable_accommodation, zero_income_statement,
-- healthcare_provider_release, childcare_expense_verification) stay FALSE until
-- their source PDFs land and field maps are confirmed.
--
-- Seeded with 17 rows. 13 have generation_enabled=TRUE (12 sourced + 1 mapped+pending
-- that shipped in PRD-22). 4 have generation_enabled=FALSE (source-pending).
-- zero_income_statement: source PDF absent in PRD-23 → generation_enabled=FALSE.

CREATE TABLE IF NOT EXISTS public.pbv_form_templates (
  form_id             TEXT        PRIMARY KEY,
  display_name_en     TEXT        NOT NULL,
  display_name_es     TEXT        NOT NULL,
  display_name_pt     TEXT,
  generation_enabled  BOOLEAN     NOT NULL DEFAULT FALSE,
  source_pdf_status   TEXT        NOT NULL DEFAULT 'pending'
    CHECK (source_pdf_status IN ('pending', 'sourced', 'verified')),
  per_person_scope    TEXT        NOT NULL
    CHECK (per_person_scope IN ('submission_level', 'head_of_household_only', 'each_adult', 'each_member', 'individual')),
  conditional_rule    TEXT,
  category            TEXT,
  notes               TEXT
);

ALTER TABLE public.pbv_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_form_templates"
  ON public.pbv_form_templates
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.pbv_form_templates IS
  'Form-execution metadata for each PBV form. Controls which forms are generated at '
  'generate-forms time (generation_enabled) and under what conditions (conditional_rule). '
  'Separate from form_document_templates which controls upload-slot seeding. '
  'conditional_rule: a string key evaluated by lib/pbv/conditional-rules.ts. '
  'NULL = always generate when generation_enabled=TRUE.';

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: 17 rows — 13 generation_enabled=TRUE, 4 generation_enabled=FALSE
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.pbv_form_templates
  (form_id, display_name_en, display_name_es, generation_enabled, source_pdf_status, per_person_scope, conditional_rule, category, notes)
VALUES

-- ── ALWAYS GENERATED (submission-level) ──────────────────────────────────────

(
  'main_application',
  'HCV Application for Continued Occupancy',
  'Solicitud HCV de Ocupación Continuada',
  TRUE, 'verified', 'submission_level', NULL, 'application',
  '5-page main application. Sourced + field-mapped in PRD-22/23.'
),
(
  'citizenship_declaration',
  'Citizenship Declaration',
  'Declaración de Ciudadanía',
  TRUE, 'verified', 'each_adult', NULL, 'declaration',
  'Per-adult citizenship and immigration status declaration.'
),
(
  'obligations_of_family',
  'Obligations of Family',
  'Obligaciones de la Familia',
  TRUE, 'verified', 'head_of_household_only', NULL, 'obligations',
  'HOH acknowledgment of family obligations.'
),
(
  'hud_9886a',
  'HUD-9886-A Authorization for Release of Information',
  'HUD-9886-A Autorización para Divulgar Información',
  TRUE, 'verified', 'each_adult', NULL, 'release',
  'Federal authorization form, all adults must sign.'
),
(
  'hach_release',
  'HACH Authorization for Release of Information',
  'Autorización HACH para Divulgar Información',
  TRUE, 'verified', 'each_adult', NULL, 'release',
  'HACH-specific release. 15-month expiration.'
),
(
  'hud_92006',
  'HUD-92006 Supplemental Contact Form',
  'Formulario de Contacto Suplementario HUD-92006',
  TRUE, 'verified', 'head_of_household_only', NULL, 'application',
  'HOH emergency contact and supplemental form.'
),
(
  'child_support_affidavit',
  'Child Support Affidavit',
  'Declaración Jurada de Manutención Infantil',
  TRUE, 'verified', 'individual', 'household_has_child_support', 'affidavit',
  'Required when any member has child_support income. Conditional on income intake.'
),
(
  'no_child_support_affidavit',
  'No Child Support Affidavit',
  'Declaración Jurada de Ausencia de Manutención',
  TRUE, 'verified', 'head_of_household_only', 'household_no_child_support', 'affidavit',
  'Required when no member has child_support income. Mutually exclusive with child_support_affidavit.'
),
(
  'pet_addendum',
  'Pet Addendum',
  'Addendum de Mascotas',
  TRUE, 'verified', 'head_of_household_only', 'intake_has_pets', 'addendum',
  'Required when household has pets. Conditional on intake.'
),
(
  'vehicle_addendum',
  'Vehicle Addendum',
  'Addendum de Vehículo',
  TRUE, 'verified', 'head_of_household_only', 'intake_has_vehicle', 'addendum',
  'Required when household has a vehicle. Conditional on intake.'
),
(
  'self_employment_worksheet',
  'Self-Employment Income Worksheet',
  'Hoja de Trabajo de Ingresos por Cuenta Propia',
  TRUE, 'verified', 'individual', 'household_has_self_employment', 'worksheet',
  'Required when any member has self-employment income.'
),
(
  'briefing_docs_certification',
  'Family Certification of Briefing Documents Received',
  'Certificación Familiar de Haber Recibido Documentos de Orientación',
  TRUE, 'verified', 'submission_level', NULL, 'certification',
  'Sourced + field-mapped in PRD-22.'
),
(
  'debts_owed_phas',
  'Debts Owed to PHAs (HUD-52675)',
  'Deudas con Autoridades de Vivienda (HUD-52675)',
  TRUE, 'verified', 'each_adult', NULL, 'application',
  'HUD-52675. Sourced + field-mapped in PRD-22.'
),

-- ── SOURCE-PENDING (generation_enabled=FALSE) ─────────────────────────────

(
  'vawa_certification',
  'VAWA Certification (HUD-5382)',
  'Certificación VAWA (HUD-5382)',
  FALSE, 'pending', 'head_of_household_only', 'q8_dv_yes', 'certification',
  'Source PDF not yet in hand. Conditional on q8_dv_yes (domestic violence disclosure).'
),
(
  'reasonable_accommodation_request',
  'Reasonable Accommodation Request',
  'Solicitud de Ajuste Razonable',
  FALSE, 'pending', 'head_of_household_only', 'q10_reasonable_accommodation_yes', 'application',
  'Source PDF not yet in hand. Conditional on Q10 reasonable accommodation answer.'
),
(
  'zero_income_statement',
  'Zero Income Statement',
  'Declaración de Cero Ingresos',
  FALSE, 'pending', 'individual', 'section_iii_zero_income_any_adult', 'affidavit',
  'Source PDF absent in PRD-23. generation_enabled=FALSE until source PDF confirmed and field map verified.'
),
(
  'eiv_guide_receipt',
  'EIV Guide Receipt',
  'Recibo de la Guía EIV',
  FALSE, 'pending', 'each_adult', NULL, 'receipt',
  'Source PDF not yet sourced for form execution. generation_enabled=FALSE.'
)

ON CONFLICT (form_id) DO UPDATE SET
  display_name_en    = EXCLUDED.display_name_en,
  display_name_es    = EXCLUDED.display_name_es,
  source_pdf_status  = EXCLUDED.source_pdf_status,
  per_person_scope   = EXCLUDED.per_person_scope,
  conditional_rule   = EXCLUDED.conditional_rule,
  category           = EXCLUDED.category,
  notes              = EXCLUDED.notes;
  -- NOTE: generation_enabled is NOT in the UPDATE SET — it is only set at INSERT time.
  -- Subsequent re-runs of this migration do not accidentally re-disable a row
  -- that was manually enabled after a source PDF landed.

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification: expect 17 rows, 13 enabled, 4 disabled
-- SELECT generation_enabled, COUNT(*) FROM public.pbv_form_templates GROUP BY 1;
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- DROP TABLE IF EXISTS public.pbv_form_templates CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────
