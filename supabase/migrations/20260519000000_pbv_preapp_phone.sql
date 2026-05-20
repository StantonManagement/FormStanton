ALTER TABLE pbv_preapplications ADD COLUMN IF NOT EXISTS phone TEXT;
COMMENT ON COLUMN pbv_preapplications.phone IS 'Tenant phone for SMS invitations and pre-invite outreach. Captured manually by staff.';
