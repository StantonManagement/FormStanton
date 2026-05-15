-- Make hoh_is_citizen nullable to support 'unsure' citizenship answers
-- When citizenship_answer is 'unsure', hoh_is_citizen should be NULL (not true/false)

ALTER TABLE public.pbv_preapplications 
ALTER COLUMN hoh_is_citizen DROP NOT NULL;

COMMENT ON COLUMN public.pbv_preapplications.hoh_is_citizen IS
  'NULL when citizenship status is unsure; TRUE if citizen, FALSE if not.';
