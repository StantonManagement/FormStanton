-- Extend pbv_income_thresholds with zipcode support for multiple MSA areas
-- Hartford MSA buildings use the same limits, but schema supports different MSAs

-- Add zipcode column
ALTER TABLE public.pbv_income_thresholds 
ADD COLUMN IF NOT EXISTS zipcode TEXT;

-- Update existing rows to have NULL zipcode (maintains backward compatibility)
-- Future rows will specify zipcode for area-specific lookups

-- Create composite index for efficient zipcode + household_size lookups
CREATE INDEX IF NOT EXISTS idx_pbv_income_thresholds_lookup 
ON public.pbv_income_thresholds (zipcode, household_size, effective_date DESC);

-- Also create index without zipcode for backward compatible lookups
CREATE INDEX IF NOT EXISTS idx_pbv_income_thresholds_no_zip 
ON public.pbv_income_thresholds (household_size, effective_date DESC) 
WHERE zipcode IS NULL;

-- Seed official FY2025 HUD income limits for Hartford MSA (25540)
-- All Hartford portfolio buildings are in this MSA with same limits
-- Zipcodes: 06106, 06114, 06105, 06120 (all same limits)

-- Clear placeholder seed data (if exists) and insert official HUD limits
DELETE FROM public.pbv_income_thresholds 
WHERE effective_date = '2026-01-01' AND income_limit IN (40000, 70000, 100000, 130000, 160000, 190000, 220000, 250000);

-- Insert 50% AMI (Very Low Income) limits - PBV Program standard
-- FY2025 Hartford-West Hartford-East Hartford, CT MSA
INSERT INTO public.pbv_income_thresholds (household_size, income_limit, effective_date, zipcode) VALUES
  (1, 38450, '2025-01-01', '06106'),
  (2, 43950, '2025-01-01', '06106'),
  (3, 49450, '2025-01-01', '06106'),
  (4, 54900, '2025-01-01', '06106'),
  (5, 59300, '2025-01-01', '06106'),
  (6, 63700, '2025-01-01', '06106'),
  (7, 68100, '2025-01-01', '06106'),
  (8, 72500, '2025-01-01', '06106'),
  
  (1, 38450, '2025-01-01', '06114'),
  (2, 43950, '2025-01-01', '06114'),
  (3, 49450, '2025-01-01', '06114'),
  (4, 54900, '2025-01-01', '06114'),
  (5, 59300, '2025-01-01', '06114'),
  (6, 63700, '2025-01-01', '06114'),
  (7, 68100, '2025-01-01', '06114'),
  (8, 72500, '2025-01-01', '06114'),
  
  (1, 38450, '2025-01-01', '06105'),
  (2, 43950, '2025-01-01', '06105'),
  (3, 49450, '2025-01-01', '06105'),
  (4, 54900, '2025-01-01', '06105'),
  (5, 59300, '2025-01-01', '06105'),
  (6, 63700, '2025-01-01', '06105'),
  (7, 68100, '2025-01-01', '06105'),
  (8, 72500, '2025-01-01', '06105'),
  
  (1, 38450, '2025-01-01', '06120'),
  (2, 43950, '2025-01-01', '06120'),
  (3, 49450, '2025-01-01', '06120'),
  (4, 54900, '2025-01-01', '06120'),
  (5, 59300, '2025-01-01', '06120'),
  (6, 63700, '2025-01-01', '06120'),
  (7, 68100, '2025-01-01', '06120'),
  (8, 72500, '2025-01-01', '06120')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.pbv_income_thresholds IS
  'PBV income thresholds by zipcode and household size. ';

COMMENT ON COLUMN public.pbv_income_thresholds.zipcode IS
  'NULL = generic/default threshold; zipcode = area-specific threshold for multi-MSA support.';
