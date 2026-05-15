-- Fix qualification_result CHECK constraint to include 'needs_citizenship_review'
-- This value is used when citizenship_answer is 'unsure' in the preapp form

-- Drop existing CHECK constraint and recreate with new value
ALTER TABLE public.pbv_preapplications 
DROP CONSTRAINT IF EXISTS pbv_preapplications_qualification_result_check;

ALTER TABLE public.pbv_preapplications 
ADD CONSTRAINT pbv_preapplications_qualification_result_check 
CHECK (qualification_result IN ('likely_qualifies', 'over_income', 'citizenship_issue', 'over_income_and_citizenship', 'needs_citizenship_review'));

COMMENT ON COLUMN public.pbv_preapplications.qualification_result IS
  'Likely qualifies, over income, citizenship issues, or needs citizenship review (when answer is unsure). ';
