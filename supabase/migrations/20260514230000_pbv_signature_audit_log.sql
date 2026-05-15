-- Migration: pbv_signature_audit_log
-- PRD-18: E-sign audit trail for PBV full application signatures.
-- One row per document per signer per signing event (re-signs produce additional rows).

CREATE TABLE pbv_signature_audit_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        UUID        NOT NULL REFERENCES pbv_full_applications(id),
  document_id           UUID        NOT NULL REFERENCES application_documents(id),
  member_id             UUID        NOT NULL REFERENCES pbv_household_members(id),
  signer_name           TEXT        NOT NULL,
  slot                  INTEGER     NOT NULL,
  signed_at             TIMESTAMPTZ NOT NULL,
  consent_confirmed     BOOLEAN     NOT NULL DEFAULT false,
  consent_confirmed_at  TIMESTAMPTZ,
  ip_address            TEXT,
  user_agent            TEXT,
  storage_path          TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pbv_signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenants have no read access; all reads go through supabaseAdmin in API routes.
CREATE POLICY "audit_log_no_tenant_access"
  ON pbv_signature_audit_log
  FOR ALL
  TO authenticated
  USING (false);

CREATE INDEX idx_sig_audit_application_id ON pbv_signature_audit_log (application_id);
CREATE INDEX idx_sig_audit_document_id    ON pbv_signature_audit_log (document_id);
CREATE INDEX idx_sig_audit_member_id      ON pbv_signature_audit_log (member_id);
