-- Income Eligibility Engine — Schema + Seed
-- Creates hud_ami_limits (HUD Area Median Income lookup table)
-- and pbv_income_sources (per-member income source catalog).
-- Idempotent: IF NOT EXISTS throughout.
--
-- TODO: confirm with Dan — HUD AMI figures for Hartford MSA 25540 are PLACEHOLDER.
-- Sourced from FY2025 HUD Income Limits Documentation — Hartford-West Hartford-East Hartford, CT MSA.
-- Replace with official HUD published figures before go-live.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.pbv_income_sources CASCADE;
--   DROP TABLE IF EXISTS public.hud_ami_limits CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. hud_ami_limits
--    One row per (msa_code, effective_year, ami_pct, household_size).
--    ami_pct: 30 = Extremely Low, 50 = Very Low, 80 = Low.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hud_ami_limits (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  msa_code         TEXT        NOT NULL,
  msa_name         TEXT,
  effective_year   INTEGER     NOT NULL,
  ami_pct          INTEGER     NOT NULL CHECK (ami_pct IN (30, 50, 80, 100)),
  household_size   INTEGER     NOT NULL CHECK (household_size BETWEEN 1 AND 8),
  annual_limit     NUMERIC(10,2) NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  created_by       TEXT,
  UNIQUE (msa_code, effective_year, ami_pct, household_size)
);

ALTER TABLE public.hud_ami_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on hud_ami_limits"
  ON public.hud_ami_limits
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_hud_ami_limits_updated_at
  BEFORE UPDATE ON public.hud_ami_limits
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_hud_ami_limits_lookup
  ON public.hud_ami_limits (msa_code, effective_year DESC, ami_pct, household_size);

COMMENT ON TABLE public.hud_ami_limits IS
  'HUD Area Median Income limits by MSA, year, AMI percentage band, and household size. '
  'Seeded with placeholder Hartford MSA figures — TODO: confirm with Dan.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seed Hartford MSA (25540) FY2025 AMI limits
--    TODO: confirm with Dan — these are placeholder figures
--    Reference: HUD FY2025 Income Limits Documentation
--    Hartford-West Hartford-East Hartford, CT HUD Metro FMR Area
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.hud_ami_limits (msa_code, msa_name, effective_year, ami_pct, household_size, annual_limit)
VALUES

-- 30% AMI — Extremely Low Income
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 1, 23050.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 2, 26350.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 3, 29650.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 4, 32900.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 5, 35550.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 6, 38200.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 7, 40800.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 30, 8, 43450.00),

-- 50% AMI — Very Low Income (PBV program limit)
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 1, 38450.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 2, 43950.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 3, 49450.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 4, 54900.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 5, 59300.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 6, 63700.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 7, 68100.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 50, 8, 72500.00),

-- 80% AMI — Low Income
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 1, 61500.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 2, 70300.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 3, 79100.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 4, 87800.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 5, 94850.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 6, 101900.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 7, 108950.00),
('25540', 'Hartford-West Hartford-East Hartford, CT', 2025, 80, 8, 116000.00)

ON CONFLICT (msa_code, effective_year, ami_pct, household_size) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pbv_income_sources
--    One row per income source per household member per application.
--    Seeded from intake form data via lib/pbv/income-sources.ts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pbv_income_sources (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  full_application_id  UUID          NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  member_id            UUID          REFERENCES public.pbv_household_members(id) ON DELETE SET NULL,
  source_type          TEXT          NOT NULL,
  frequency            TEXT          NOT NULL
    CHECK (frequency IN ('weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'annual', 'paystubs')),
  amount               NUMERIC(10,2),
  paystub_count        INTEGER,
  paystub_amounts      JSONB,
  employer_name        TEXT,
  annual_amount        NUMERIC(10,2),
  synced_from_intake   BOOLEAN       NOT NULL DEFAULT FALSE,
  verified_at          TIMESTAMPTZ,
  verified_by          TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by           TEXT
);

ALTER TABLE public.pbv_income_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on pbv_income_sources"
  ON public.pbv_income_sources
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE TRIGGER set_pbv_income_sources_updated_at
  BEFORE UPDATE ON public.pbv_income_sources
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_pbv_income_sources_application
  ON public.pbv_income_sources (full_application_id);

CREATE INDEX IF NOT EXISTS idx_pbv_income_sources_member
  ON public.pbv_income_sources (member_id);

COMMENT ON TABLE public.pbv_income_sources IS
  'Per-member income source catalog for each PBV full application. '
  'Seeded from intake form JSONB via syncIncomeSourcesFromIntake(). '
  'annual_amount is computed and stored by computeHouseholdIncome().';

COMMENT ON COLUMN public.pbv_income_sources.frequency IS
  'weekly=x52, bi_weekly=x26, semi_monthly=x24, monthly=x12, annual=x1, '
  'paystubs=average paystub_amounts then multiply by 52 (4 weekly) or 26 (2 bi-weekly).';
