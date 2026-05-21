-- Add unique constraint for upsert support on income thresholds
-- Matches the onConflict clause used in the API: household_size, zipcode, effective_date

ALTER TABLE public.pbv_income_thresholds
  ADD CONSTRAINT pbv_income_thresholds_size_zip_date_unique
  UNIQUE NULLS NOT DISTINCT (household_size, zipcode, effective_date);
