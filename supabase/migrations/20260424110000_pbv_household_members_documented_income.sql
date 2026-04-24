-- Add documented_income to pbv_household_members
-- Populated by staff reviewer after verifying income documents.
-- NULL = not yet reviewed. Used by qualification math panel in Phase 6 admin UI.

ALTER TABLE public.pbv_household_members
  ADD COLUMN IF NOT EXISTS documented_income NUMERIC(10,2);

COMMENT ON COLUMN public.pbv_household_members.documented_income IS
  'Income amount verified by staff reviewer from submitted documents (paystubs, award letters, etc.). '
  'NULL until staff enters a value on the qualification review panel. '
  'Compared against annual_income (claimed) to compute the income delta.';
