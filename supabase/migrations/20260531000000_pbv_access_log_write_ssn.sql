-- ============================================================================
-- Staff SSN data-entry / correction — extend pbv_access_log action vocabulary.
--
-- Adds 'write_ssn' so the admin SSN editor can record full-SSN WRITES (not just
-- reads) to the access log. Every full-SSN entry/correction by staff is audited
-- here alongside the existing 'read_ssn' rows.
-- ============================================================================

ALTER TABLE public.pbv_access_log
  DROP CONSTRAINT IF EXISTS pbv_access_log_action_check;

ALTER TABLE public.pbv_access_log
  ADD CONSTRAINT pbv_access_log_action_check
  CHECK (action IN (
    'read_ssn',
    'write_ssn',
    'export_application',
    'generate_hha',
    'admin_view_ssn'
  ));

COMMENT ON COLUMN public.pbv_access_log.action IS
  'read_ssn = full SSN decrypted/viewed; write_ssn = full SSN entered/corrected by '
  'staff; export_application / generate_hha = bulk PII access; admin_view_ssn = legacy.';
