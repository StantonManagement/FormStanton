ALTER TABLE pbv_preapplications
  ADD COLUMN IF NOT EXISTS unit_not_in_canonical_list boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submission_source text NOT NULL DEFAULT 'open_enrollment'
    CHECK (submission_source IN ('magic_link', 'open_enrollment'));

-- Back-fill existing rows (created before this column existed = magic_link)
UPDATE pbv_preapplications
  SET submission_source = 'magic_link'
  WHERE project_unit_id IS NOT NULL;
