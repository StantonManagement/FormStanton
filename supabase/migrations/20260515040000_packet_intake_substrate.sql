-- Packet Intake Substrate
-- Creates intake_batches, intake_pages, and doc_type_signatures tables,
-- plus seeds all 108 doc_type_signatures rows for form_id = 'pbv-full-application'.
--
-- Reconstructed from live prod schema on 2026-05-14.
-- All CREATE TABLE / CREATE INDEX / CREATE POLICY statements use IF NOT EXISTS
-- or equivalent guards so this migration is a no-op against prod.
--
-- Dependencies: trigger_set_updated_at() must exist (created in earlier migrations).
-- No FK to pbv_full_applications or any other table (polymorphic anchor pattern).

-- ---------------------------------------------------------------------------
-- intake_batches
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intake_batches (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anchor_type              TEXT        NOT NULL CHECK (anchor_type = 'pbv_full_application'),
  anchor_id                UUID        NOT NULL,
  status                   TEXT        NOT NULL DEFAULT 'uploading'
                             CHECK (status IN ('uploading','classifying','committing','committed','abandoned')),
  source_label             TEXT,
  total_pages              INTEGER,
  committed_at             TIMESTAMPTZ,
  committed_document_count INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               TEXT,
  created_by_user_id       UUID
);

CREATE INDEX IF NOT EXISTS idx_intake_batches_anchor
  ON public.intake_batches (anchor_type, anchor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_batches_status
  ON public.intake_batches (status);

ALTER TABLE public.intake_batches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'intake_batches'
      AND policyname = 'service_role full access on intake_batches'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service_role full access on intake_batches"
        ON public.intake_batches
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_intake_batches_updated_at ON public.intake_batches;
CREATE TRIGGER trg_intake_batches_updated_at
  BEFORE UPDATE ON public.intake_batches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- intake_pages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.intake_pages (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id              UUID        NOT NULL REFERENCES public.intake_batches(id) ON DELETE CASCADE,
  source_file_name      TEXT,
  page_index            INTEGER     NOT NULL,
  global_index          INTEGER     NOT NULL,
  image_path            TEXT,
  extracted_text        TEXT,
  ocr_confidence        TEXT        CHECK (ocr_confidence IS NULL OR ocr_confidence IN ('high','medium','low','none')),
  suggested_doc_type    TEXT,
  suggested_person_slot INTEGER,
  suggested_score       DOUBLE PRECISION,
  staged_assignment     JSONB,
  committed_document_id UUID,
  storage_move_failed   BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            TEXT
);

CREATE INDEX IF NOT EXISTS idx_intake_pages_batch
  ON public.intake_pages (batch_id, global_index);

CREATE INDEX IF NOT EXISTS idx_intake_pages_committed_document
  ON public.intake_pages (committed_document_id)
  WHERE committed_document_id IS NOT NULL;

ALTER TABLE public.intake_pages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'intake_pages'
      AND policyname = 'service_role full access on intake_pages'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service_role full access on intake_pages"
        ON public.intake_pages
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_intake_pages_updated_at ON public.intake_pages;
CREATE TRIGGER trg_intake_pages_updated_at
  BEFORE UPDATE ON public.intake_pages
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- doc_type_signatures
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.doc_type_signatures (
  id                  UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id             TEXT          NOT NULL,
  doc_type            TEXT          NOT NULL,
  signature_kind      TEXT          NOT NULL CHECK (signature_kind IN ('regex','phrase','form_number')),
  pattern             TEXT          NOT NULL,
  weight              DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  negative            BOOLEAN       NOT NULL DEFAULT false,
  min_score_for_match DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_by          TEXT,

  CONSTRAINT doc_type_signatures_unique UNIQUE (form_id, doc_type, signature_kind, pattern)
);

CREATE INDEX IF NOT EXISTS idx_doc_type_signatures_form_id
  ON public.doc_type_signatures (form_id);

ALTER TABLE public.doc_type_signatures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'doc_type_signatures'
      AND policyname = 'service_role full access on doc_type_signatures'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "service_role full access on doc_type_signatures"
        ON public.doc_type_signatures
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_doc_type_signatures_updated_at ON public.doc_type_signatures;
CREATE TRIGGER trg_doc_type_signatures_updated_at
  BEFORE UPDATE ON public.doc_type_signatures
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: doc_type_signatures for form_id = 'pbv-full-application'
-- 108 rows. Idempotent via ON CONFLICT DO UPDATE.
-- Reconstructed from live prod on 2026-05-14.
-- ---------------------------------------------------------------------------

INSERT INTO public.doc_type_signatures
  (form_id, doc_type, signature_kind, pattern, weight, negative, min_score_for_match)
VALUES
  ('pbv-full-application','bank_statement_checking','phrase','Beginning Balance',0.3,false,0.7),
  ('pbv-full-application','bank_statement_checking','phrase','Checking',0.4,false,0.7),
  ('pbv-full-application','bank_statement_checking','phrase','Checking Account',0.5,false,0.7),
  ('pbv-full-application','bank_statement_checking','phrase','Statement Period',0.4,false,0.7),
  ('pbv-full-application','bank_statement_savings','phrase','Beginning Balance',0.3,false,0.7),
  ('pbv-full-application','bank_statement_savings','phrase','Savings',0.5,false,0.7),
  ('pbv-full-application','bank_statement_savings','phrase','Savings Account',0.6,false,0.7),
  ('pbv-full-application','bank_statement_savings','phrase','Statement Period',0.4,false,0.7),
  ('pbv-full-application','briefing_docs_certification','phrase','Briefing',0.4,false,0.5),
  ('pbv-full-application','briefing_docs_certification','phrase','Certification',0.3,false,0.5),
  ('pbv-full-application','briefing_docs_certification','phrase','Voucher',0.3,false,0.5),
  ('pbv-full-application','care4kids_certificate','phrase','Care 4 Kids',0.9,false,0.5),
  ('pbv-full-application','care4kids_certificate','phrase','Certificate',0.3,false,0.5),
  ('pbv-full-application','care4kids_certificate','phrase','Childcare',0.4,false,0.5),
  ('pbv-full-application','cd_trust_bond','phrase','Bond Statement',0.6,false,0.5),
  ('pbv-full-application','cd_trust_bond','phrase','Certificate of Deposit',0.7,false,0.5),
  ('pbv-full-application','cd_trust_bond','phrase','Trust Account',0.6,false,0.5),
  ('pbv-full-application','child_support_affidavit','phrase','Affidavit',0.5,false,0.5),
  ('pbv-full-application','child_support_affidavit','phrase','Child Support',0.6,false,0.5),
  ('pbv-full-application','child_support_docs','phrase','Child Support Order',0.7,false,0.5),
  ('pbv-full-application','child_support_docs','phrase','Payment History',0.4,false,0.5),
  ('pbv-full-application','citizenship_declaration','phrase','Citizenship Declaration',0.7,false,0.5),
  ('pbv-full-application','citizenship_declaration','phrase','Eligible Non-Citizen',0.5,false,0.5),
  ('pbv-full-application','citizenship_declaration','phrase','U.S. Citizen',0.4,false,0.5),
  ('pbv-full-application','criminal_background_release','phrase','Authorization',0.2,false,0.6),
  ('pbv-full-application','criminal_background_release','phrase','Background Check',0.5,false,0.6),
  ('pbv-full-application','criminal_background_release','phrase','Criminal Background',0.5,false,0.6),
  ('pbv-full-application','criminal_background_release','phrase','Release',0.2,false,0.6),
  ('pbv-full-application','debts_owed_phas','form_number','HUD-52675',1.0,false,0.5),
  ('pbv-full-application','debts_owed_phas','phrase','Debts Owed',0.6,false,0.5),
  ('pbv-full-application','debts_owed_phas','phrase','Public Housing Agency',0.3,false,0.5),
  ('pbv-full-application','digital_payment_statements','phrase','Cash App',0.8,false,0.5),
  ('pbv-full-application','digital_payment_statements','phrase','PayPal',0.7,false,0.5),
  ('pbv-full-application','digital_payment_statements','phrase','Venmo',0.8,false,0.5),
  ('pbv-full-application','digital_payment_statements','phrase','Zelle',0.8,false,0.5),
  ('pbv-full-application','eiv_guide_receipt','phrase','EIV',0.7,false,0.5),
  ('pbv-full-application','eiv_guide_receipt','phrase','Enterprise Income Verification',0.8,false,0.5),
  ('pbv-full-application','eiv_guide_receipt','phrase','Fact Sheet',0.3,false,0.5),
  ('pbv-full-application','hach_release','phrase','Authorization for Release',0.3,false,0.5),
  ('pbv-full-application','hach_release','phrase','HACH',0.4,false,0.5),
  ('pbv-full-application','hach_release','phrase','Housing Authority of the City of Hartford',0.8,false,0.5),
  ('pbv-full-application','hud_92006','form_number','HUD-92006',1.0,false,0.5),
  ('pbv-full-application','hud_92006','phrase','Supplemental Contact',0.6,false,0.5),
  ('pbv-full-application','hud_9886a','form_number','HUD-9886-A',1.0,false,0.5),
  ('pbv-full-application','hud_9886a','phrase','Authorization for Release of Information',0.6,false,0.5),
  ('pbv-full-application','hud_9886a','phrase','HUD 9886',0.8,false,0.5),
  ('pbv-full-application','immigration_docs','phrase','Green Card',0.6,false,0.5),
  ('pbv-full-application','immigration_docs','phrase','I-551',0.8,false,0.5),
  ('pbv-full-application','immigration_docs','phrase','I-688',0.7,false,0.5),
  ('pbv-full-application','immigration_docs','phrase','I-94',0.7,false,0.5),
  ('pbv-full-application','insurance_settlement','phrase','Insurance Settlement',0.8,false,0.5),
  ('pbv-full-application','insurance_settlement','phrase','Settlement Letter',0.6,false,0.5),
  ('pbv-full-application','life_insurance_policy','phrase','Cash Value',0.6,false,0.5),
  ('pbv-full-application','life_insurance_policy','phrase','Life Insurance',0.8,false,0.5),
  ('pbv-full-application','life_insurance_policy','phrase','Policy Number',0.3,false,0.5),
  ('pbv-full-application','main_application','phrase','Application for Housing',0.7,false,0.5),
  ('pbv-full-application','main_application','phrase','Head of Household',0.4,false,0.5),
  ('pbv-full-application','main_application','phrase','Household Composition',0.4,false,0.5),
  ('pbv-full-application','medical_bills','phrase','Amount Due',0.3,false,0.5),
  ('pbv-full-application','medical_bills','phrase','Hospital',0.3,false,0.5),
  ('pbv-full-application','medical_bills','phrase','Medical Center',0.4,false,0.5),
  ('pbv-full-application','medical_bills','phrase','Patient Statement',0.6,false,0.5),
  ('pbv-full-application','obligations_of_family','phrase','Family Obligations',0.6,false,0.5),
  ('pbv-full-application','obligations_of_family','phrase','Obligations of the Family',0.8,false,0.5),
  ('pbv-full-application','paystubs','phrase','Deductions',0.2,false,0.6),
  ('pbv-full-application','paystubs','phrase','Earnings',0.3,false,0.6),
  ('pbv-full-application','paystubs','phrase','Gross Pay',0.3,false,0.6),
  ('pbv-full-application','paystubs','phrase','Net Pay',0.2,false,0.6),
  ('pbv-full-application','paystubs','phrase','Pay Period',0.3,false,0.6),
  ('pbv-full-application','paystubs','phrase','YTD',0.2,false,0.6),
  ('pbv-full-application','pension_letter','phrase','Award Letter',0.3,false,0.5),
  ('pbv-full-application','pension_letter','phrase','Pension',0.7,false,0.5),
  ('pbv-full-application','pension_letter','phrase','Railroad Retirement',0.8,false,0.5),
  ('pbv-full-application','pharmacy_statements','phrase','CVS',0.4,false,0.5),
  ('pbv-full-application','pharmacy_statements','phrase','Pharmacy',0.7,false,0.5),
  ('pbv-full-application','pharmacy_statements','phrase','Prescription',0.5,false,0.5),
  ('pbv-full-application','pharmacy_statements','phrase','Walgreens',0.4,false,0.5),
  ('pbv-full-application','proof_of_age_noncitizen','phrase','Birth Certificate',0.6,false,0.5),
  ('pbv-full-application','proof_of_age_noncitizen','phrase','Date of Birth',0.4,false,0.5),
  ('pbv-full-application','proof_of_age_noncitizen','phrase','Passport',0.5,false,0.5),
  ('pbv-full-application','reasonable_accommodation_request','phrase','Disability',0.3,false,0.5),
  ('pbv-full-application','reasonable_accommodation_request','phrase','Reasonable Accommodation',0.9,false,0.5),
  ('pbv-full-application','self_employment_docs','phrase','Profit and Loss',0.6,false,0.5),
  ('pbv-full-application','self_employment_docs','phrase','Schedule C',0.6,false,0.5),
  ('pbv-full-application','self_employment_docs','phrase','Self-Employment',0.7,false,0.5),
  ('pbv-full-application','ss_award_letter','phrase','Award Letter',0.3,false,0.5),
  ('pbv-full-application','ss_award_letter','phrase','Retirement Benefits',0.5,false,0.5),
  ('pbv-full-application','ss_award_letter','phrase','Social Security',0.5,false,0.5),
  ('pbv-full-application','ss_award_letter','phrase','Social Security Administration',0.3,false,0.5),
  ('pbv-full-application','ssi_award_letter','phrase','Award Letter',0.3,false,0.5),
  ('pbv-full-application','ssi_award_letter','phrase','Social Security Administration',0.3,false,0.5),
  ('pbv-full-application','ssi_award_letter','phrase','SSI',0.6,false,0.5),
  ('pbv-full-application','ssi_award_letter','phrase','Supplemental Security Income',0.8,false,0.5),
  ('pbv-full-application','tanf_letter','phrase','Food Stamps',0.6,false,0.5),
  ('pbv-full-application','tanf_letter','phrase','Public Assistance',0.4,false,0.5),
  ('pbv-full-application','tanf_letter','phrase','SNAP',0.6,false,0.5),
  ('pbv-full-application','tanf_letter','phrase','TANF',0.8,false,0.5),
  ('pbv-full-application','training_letter','phrase','Grant',0.4,false,0.5),
  ('pbv-full-application','training_letter','phrase','Stipend',0.5,false,0.5),
  ('pbv-full-application','training_letter','phrase','Training Program',0.7,false,0.5),
  ('pbv-full-application','unemployment_letter','phrase','Benefit Year',0.4,false,0.5),
  ('pbv-full-application','unemployment_letter','phrase','Unemployment',0.7,false,0.5),
  ('pbv-full-application','unemployment_letter','phrase','Workers Compensation',0.7,false,0.5),
  ('pbv-full-application','vawa_certification','form_number','HUD-5382',1.0,false,0.5),
  ('pbv-full-application','vawa_certification','phrase','VAWA',0.8,false,0.5),
  ('pbv-full-application','vawa_certification','phrase','Violence Against Women',0.8,false,0.5)
ON CONFLICT (form_id, doc_type, signature_kind, pattern) DO UPDATE SET
  weight              = EXCLUDED.weight,
  negative            = EXCLUDED.negative,
  min_score_for_match = EXCLUDED.min_score_for_match;

-- ---------------------------------------------------------------------------
-- ROLLBACK INSTRUCTIONS
-- DROP TABLE IF EXISTS public.intake_pages;
-- DROP TABLE IF EXISTS public.intake_batches;
-- DROP TABLE IF EXISTS public.doc_type_signatures;
-- ---------------------------------------------------------------------------
