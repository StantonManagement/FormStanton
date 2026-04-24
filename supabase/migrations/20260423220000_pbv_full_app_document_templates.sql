-- PBV Full Application: form_document_templates seed
-- form_id = 'pbv-full-application'
-- Apply after: 20260423180000_foundation_review_per_document.sql
--              20260423210000_pbv_full_application_tables.sql
--
-- member_filter shape evaluated by lib/memberFilter.ts matchesMemberFilter():
--   single criterion: {"field": "employed", "value": true}
--   array (ANDed):    [{"field": "citizenship_status", "value": "eligible_non_citizen"}, {"field": "age", "op": "gte", "value": 62}]
--
-- conditional_on shape: stored JSONB, evaluated in application UI layer (Phase 5/6), NOT at seeding.
-- Seeding always creates all slots; conditional_on controls UI visibility only.
--
-- per_person = TRUE  → seeding creates one slot per matched member
-- per_person = FALSE → seeding creates one submission-level slot (person_slot = 0)
--
-- Income boolean flags (employed, has_ssi, etc.) are written to form_data.household_members
-- by the Phase 3 intake form, derived from the income_sources array.
-- Age is computed from date_of_birth at intake and written as member.age.

INSERT INTO public.form_document_templates
  (form_id, doc_type, label, label_es, label_pt, required, conditional_on, display_order, per_person, applies_to, member_filter)
VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- INCOME VERIFICATION (per member, filtered by income source flag)
-- ─────────────────────────────────────────────────────────────────────────────

(
  'pbv-full-application', 'paystubs',
  'Paystubs (last 4 weekly or 2 bi-weekly per employed person)',
  'Talones de pago (últimas 4 semanas o 2 quincenas por persona empleada)',
  'Contracheques (últimas 4 semanas ou 2 quinzenas por pessoa empregada)',
  TRUE, NULL, 10, TRUE, 'each_member_matching_rule',
  '{"field": "employed", "value": true}'
),
(
  'pbv-full-application', 'pension_letter',
  'Pension or Railroad Retirement Award Letter',
  'Carta de pensión o retiro ferroviario',
  'Carta de pensão ou aposentadoria ferroviária',
  TRUE, NULL, 20, TRUE, 'each_member_matching_rule',
  '{"field": "has_pension", "value": true}'
),
(
  'pbv-full-application', 'ssi_award_letter',
  'SSI Award Letter',
  'Carta de adjudicación de SSI',
  'Carta de concessão de SSI',
  TRUE, NULL, 30, TRUE, 'each_member_matching_rule',
  '{"field": "has_ssi", "value": true}'
),
(
  'pbv-full-application', 'ss_award_letter',
  'Social Security Award Letter',
  'Carta de adjudicación del Seguro Social',
  'Carta de concessão da Previdência Social',
  TRUE, NULL, 40, TRUE, 'each_member_matching_rule',
  '{"field": "has_ss", "value": true}'
),
(
  'pbv-full-application', 'child_support_docs',
  'Child Support Order or Payment History (last 12 months)',
  'Orden de manutención infantil o historial de pagos (últimos 12 meses)',
  'Ordem de pensão alimentícia ou histórico de pagamentos (últimos 12 meses)',
  TRUE, NULL, 50, TRUE, 'each_member_matching_rule',
  '{"field": "has_child_support", "value": true}'
),
(
  'pbv-full-application', 'tanf_letter',
  'TANF, Food Stamps, or Public Assistance Award Letter',
  'Carta de adjudicación de TANF, cupones de alimentos o asistencia pública',
  'Carta de concessão de TANF, cupons alimentares ou assistência pública',
  TRUE, NULL, 60, TRUE, 'each_member_matching_rule',
  '{"field": "has_tanf", "value": true}'
),
(
  'pbv-full-application', 'unemployment_letter',
  'Unemployment or Workers Compensation Award Letter',
  'Carta de seguro de desempleo o compensación laboral',
  'Carta de seguro desemprego ou compensação de trabalhadores',
  TRUE, NULL, 70, TRUE, 'each_member_matching_rule',
  '{"field": "has_unemployment", "value": true}'
),
(
  'pbv-full-application', 'self_employment_docs',
  'Self-Employment Contract and Earnings Statement',
  'Contrato de trabajo independiente y estado de ganancias',
  'Contrato de trabalho autônomo e declaração de ganhos',
  TRUE, NULL, 80, TRUE, 'each_member_matching_rule',
  '{"field": "has_self_employment", "value": true}'
),
(
  'pbv-full-application', 'training_letter',
  'Training Program Letter or Grant Documentation (other income)',
  'Carta de programa de capacitación o documentación de beca (otros ingresos)',
  'Carta de programa de treinamento ou documentação de bolsa (outros rendimentos)',
  FALSE, NULL, 90, TRUE, 'each_member_matching_rule',
  '{"field": "has_other_income", "value": true}'
),
(
  'pbv-full-application', 'digital_payment_statements',
  'Cash App, Zelle, Venmo, or PayPal — 2 months of statements (other income)',
  'Estados de cuenta de Cash App, Zelle, Venmo o PayPal — 2 meses (otros ingresos)',
  'Extratos de Cash App, Zelle, Venmo ou PayPal — 2 meses (outros rendimentos)',
  FALSE, NULL, 100, TRUE, 'each_member_matching_rule',
  '{"field": "has_other_income", "value": true}'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- BANKING & ASSETS (per adult)
-- ─────────────────────────────────────────────────────────────────────────────

(
  'pbv-full-application', 'bank_statement_savings',
  'Savings Account Bank Statement (most recent month)',
  'Estado de cuenta bancaria de ahorros (mes más reciente)',
  'Extrato bancário de poupança (mês mais recente)',
  TRUE, NULL, 110, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'bank_statement_checking',
  'Checking Account Bank Statement (most recent month)',
  'Estado de cuenta bancaria corriente (mes más reciente)',
  'Extrato bancário de conta corrente (mês mais recente)',
  TRUE, NULL, 120, TRUE, 'each_adult',
  NULL
),

-- Asset docs are submission-level; required=FALSE because they are conditional
-- on the tenant claiming these assets. conditional_on is enforced in UI (Phase 5/6).
(
  'pbv-full-application', 'insurance_settlement',
  'Insurance Settlement Letter (if applicable)',
  'Carta de liquidación de seguro (si corresponde)',
  'Carta de liquidação de seguro (se aplicável)',
  FALSE, '{"has_insurance_settlement": true}', 130, FALSE, 'submission',
  NULL
),
(
  'pbv-full-application', 'cd_trust_bond',
  'CD, Trust, or Bond Statements (if applicable)',
  'Estados de cuenta de CD, fideicomiso o bonos (si corresponde)',
  'Extratos de CD, trust ou títulos (se aplicável)',
  FALSE, '{"has_cd_trust_bond": true}', 140, FALSE, 'submission',
  NULL
),
(
  'pbv-full-application', 'life_insurance_policy',
  'Life Insurance Policy Showing Cash Value (if applicable)',
  'Póliza de seguro de vida con valor en efectivo (si corresponde)',
  'Apólice de seguro de vida com valor em dinheiro (se aplicável)',
  FALSE, '{"has_life_insurance": true}', 150, FALSE, 'submission',
  NULL
),

-- ─────────────────────────────────────────────────────────────────────────────
-- MEDICAL & CHILDCARE (submission-level, conditional)
-- ─────────────────────────────────────────────────────────────────────────────

(
  'pbv-full-application', 'medical_bills',
  'Doctor Bills (last 12 months) — medical deduction',
  'Facturas médicas (últimos 12 meses) — deducción médica',
  'Contas médicas (últimos 12 meses) — dedução médica',
  FALSE, '{"claiming_medical_deduction": true}', 200, FALSE, 'submission',
  NULL
),
(
  'pbv-full-application', 'pharmacy_statements',
  'Pharmacy Statements (last 12 months) — medical deduction',
  'Estados de cuenta de farmacia (últimos 12 meses) — deducción médica',
  'Extratos de farmácia (últimos 12 meses) — dedução médica',
  FALSE, '{"claiming_medical_deduction": true}', 210, FALSE, 'submission',
  NULL
),
(
  'pbv-full-application', 'care4kids_certificate',
  'Care 4 Kids Certificate or Childcare Documentation',
  'Certificado de Care 4 Kids o documentación de cuidado infantil',
  'Certificado Care 4 Kids ou documentação de creche',
  FALSE, '{"has_childcare_expense": true}', 220, FALSE, 'submission',
  NULL
),

-- ─────────────────────────────────────────────────────────────────────────────
-- CITIZENSHIP / IMMIGRATION (per non-citizen member)
-- ─────────────────────────────────────────────────────────────────────────────

(
  'pbv-full-application', 'immigration_docs',
  'Immigration Documents (I-551, I-94, I-688, or I-688B)',
  'Documentos de inmigración (I-551, I-94, I-688 o I-688B)',
  'Documentos de imigração (I-551, I-94, I-688 ou I-688B)',
  TRUE, NULL, 300, TRUE, 'each_member_matching_rule',
  '{"field": "citizenship_status", "value": "eligible_non_citizen"}'
),
(
  'pbv-full-application', 'proof_of_age_noncitizen',
  'Proof of Age for Non-Citizen Members Age 62+',
  'Prueba de edad para miembros no ciudadanos de 62+ años',
  'Comprovante de idade para membros não cidadãos com 62+ anos',
  FALSE, NULL, 310, TRUE, 'each_member_matching_rule',
  '[{"field": "citizenship_status", "value": "eligible_non_citizen"}, {"field": "age", "op": "gte", "value": 62}]'
),

-- ─────────────────────────────────────────────────────────────────────────────
-- SIGNED FORMS (per adult — each member aged 18+)
-- All required=TRUE except VAWA and RA which are conditional.
-- ─────────────────────────────────────────────────────────────────────────────

(
  'pbv-full-application', 'main_application',
  'Main Application and Attestation',
  'Solicitud principal y declaración jurada',
  'Requerimento principal e declaração',
  TRUE, NULL, 400, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'criminal_background_release',
  'Criminal Background Release Authorization',
  'Autorización de divulgación de antecedentes penales',
  'Autorização de divulgação de antecedentes criminais',
  TRUE, NULL, 410, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'child_support_affidavit',
  'Child Support Affidavit (paid, received, or none)',
  'Declaración jurada de manutención infantil (pagada, recibida o ninguna)',
  'Declaração de pensão alimentícia (paga, recebida ou nenhuma)',
  TRUE, NULL, 420, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'hud_9886a',
  'HUD-9886-A Authorization for Release of Information',
  'HUD-9886-A Autorización para divulgar información',
  'HUD-9886-A Autorização para divulgação de informações',
  TRUE, NULL, 430, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'hach_release',
  'HACH Authorization for Release of Information',
  'Autorización de HACH para divulgar información',
  'Autorização da HACH para divulgação de informações',
  TRUE, NULL, 440, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'obligations_of_family',
  'Obligations of Family',
  'Obligaciones de la familia',
  'Obrigações da família',
  TRUE, NULL, 450, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'briefing_docs_certification',
  'Family Certification of Briefing Documents Received',
  'Certificación familiar de haber recibido documentos de orientación',
  'Certificação familiar de documentos de orientação recebidos',
  TRUE, NULL, 460, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'debts_owed_phas',
  'Debts Owed to PHAs (HUD-52675)',
  'Deudas con autoridades de vivienda (HUD-52675)',
  'Dívidas com autoridades de habitação (HUD-52675)',
  TRUE, NULL, 470, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'citizenship_declaration',
  'Citizenship Declaration',
  'Declaración de ciudadanía',
  'Declaração de cidadania',
  TRUE, NULL, 480, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'eiv_guide_receipt',
  'EIV Guide Receipt',
  'Recibo de la guía EIV',
  'Recibo do guia EIV',
  TRUE, NULL, 490, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'hud_92006',
  'HUD-92006 Supplemental Contact Form',
  'Formulario de contacto suplementario HUD-92006',
  'Formulário de contato suplementar HUD-92006',
  TRUE, NULL, 500, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'vawa_certification',
  'VAWA Certification (HUD-5382)',
  'Certificación VAWA (HUD-5382)',
  'Certificação VAWA (HUD-5382)',
  FALSE, '{"dv_status": true}', 510, TRUE, 'each_adult',
  NULL
),
(
  'pbv-full-application', 'reasonable_accommodation_request',
  'Reasonable Accommodation Request',
  'Solicitud de ajuste razonable',
  'Solicitação de acomodação razoável',
  FALSE, '{"reasonable_accommodation_requested": true}', 520, TRUE, 'each_adult',
  NULL
)

ON CONFLICT (form_id, doc_type) DO UPDATE SET
  label            = EXCLUDED.label,
  label_es         = EXCLUDED.label_es,
  label_pt         = EXCLUDED.label_pt,
  required         = EXCLUDED.required,
  conditional_on   = EXCLUDED.conditional_on,
  display_order    = EXCLUDED.display_order,
  per_person       = EXCLUDED.per_person,
  applies_to       = EXCLUDED.applies_to,
  member_filter    = EXCLUDED.member_filter;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- DELETE FROM public.form_document_templates WHERE form_id = 'pbv-full-application';
-- ─────────────────────────────────────────────────────────────────────────────
