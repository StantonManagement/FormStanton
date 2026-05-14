-- Migration: In-App Signature Capture (PRD V)
-- Date: 2026-05-13
-- Depends on: post-approval-execution (PRD IV)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. signature_capture_audit — immutable legal evidence record
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signature_capture_audit (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_signature_id         UUID        NOT NULL UNIQUE
                              REFERENCES public.packet_signatures(id) ON DELETE RESTRICT,
  -- Signer identity (one of staff or tenant is populated)
  signer_user_id              UUID        REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  signer_tenant_token         TEXT,
  signer_display_name         TEXT        NOT NULL,
  signer_role                 TEXT        NOT NULL CHECK (signer_role IN ('tenant', 'stanton')),
  -- Consent
  consent_recorded_at         TIMESTAMPTZ NOT NULL,
  consent_text_version        TEXT        NOT NULL,  -- e.g., 'esign-disclosure-v1'
  consent_language            TEXT        NOT NULL CHECK (consent_language IN ('en', 'es', 'ht')),
  -- Identity verification
  identity_method             TEXT        NOT NULL CHECK (identity_method IN ('magic_link_plus_dob', 'admin_session')),
  identity_verified_at        TIMESTAMPTZ NOT NULL,
  -- Document review
  document_reviewed_at        TIMESTAMPTZ NOT NULL,
  pages_viewed                INTEGER     NOT NULL,
  pdf_page_count              INTEGER     NOT NULL,
  -- Capture
  signature_method            TEXT        NOT NULL CHECK (signature_method IN ('typed', 'drawn', 'typed_and_drawn')),
  typed_name                  TEXT        NOT NULL,
  signed_at                   TIMESTAMPTZ NOT NULL,
  -- Network metadata
  ip_address                  INET        NOT NULL,
  user_agent                  TEXT        NOT NULL,
  -- Document integrity
  original_pdf_path           TEXT        NOT NULL,
  original_document_hash      TEXT        NOT NULL,  -- SHA256
  signed_pdf_path             TEXT        NOT NULL,
  signed_document_hash        TEXT        NOT NULL,  -- SHA256
  -- Delivery
  delivered_to_signer_at      TIMESTAMPTZ,
  delivery_method             TEXT        CHECK (delivery_method IS NULL OR delivery_method IN ('email', 'portal_download', 'both')),
  delivery_address            TEXT,  -- email if applicable
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One of signer_user_id or signer_tenant_token must be present
  CONSTRAINT signer_identity_present CHECK (signer_user_id IS NOT NULL OR signer_tenant_token IS NOT NULL)
);

-- Immutability: revoke UPDATE/DELETE at the table level. RLS service_role read-only.
ALTER TABLE public.signature_capture_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role read on signature_capture_audit"
  ON public.signature_capture_audit FOR SELECT TO service_role USING (TRUE);

CREATE POLICY "service_role insert on signature_capture_audit"
  ON public.signature_capture_audit FOR INSERT TO service_role WITH CHECK (TRUE);

-- No UPDATE or DELETE policies — immutability enforced.

CREATE INDEX idx_sig_audit_packet_signature ON public.signature_capture_audit (packet_signature_id);
CREATE INDEX idx_sig_audit_signer_user      ON public.signature_capture_audit (signer_user_id) WHERE signer_user_id IS NOT NULL;
CREATE INDEX idx_sig_audit_signer_token     ON public.signature_capture_audit (signer_tenant_token) WHERE signer_tenant_token IS NOT NULL;
CREATE INDEX idx_sig_audit_signed_at        ON public.signature_capture_audit (signed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. consent_text_versions — versioned consent disclosure text
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.consent_text_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_key   TEXT        NOT NULL,  -- 'esign-disclosure-v1'
  language      TEXT        NOT NULL CHECK (language IN ('en', 'es', 'ht')),
  body          TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT FALSE,  -- only one active per language at a time
  effective_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_key, language)
);

-- Partial unique index: only one active version per language
CREATE UNIQUE INDEX idx_consent_active_per_language 
  ON public.consent_text_versions (language) 
  WHERE is_active = TRUE;

-- Seed: v1 disclosure in three languages
INSERT INTO public.consent_text_versions (version_key, language, body, is_active, effective_at)
VALUES 
  (
    'esign-disclosure-v1',
    'en',
    E'You are about to sign this document electronically.\n\nBy proceeding, you agree that your electronic signature has the same legal effect as a handwritten signature under the Electronic Signatures in Global and National Commerce Act (ESIGN) and applicable state laws (UETA).\n\nYou have the right to request a paper copy of this document instead. To request a paper copy, contact Stanton Management at (617) 555-0100 or email support@stantonmanagement.com.\n\nBy checking the box below, you confirm that:\n• You have read and understand this disclosure\n• You consent to use electronic signatures\n• You have access to the technology needed to view and sign electronically\n• You can print or save a copy of this document',
    TRUE,
    NOW()
  ),
  (
    'esign-disclosure-v1',
    'es',
    E'Está a punto de firmar este documento electrónicamente.\n\nAl continuar, acepta que su firma electrónica tiene el mismo efecto legal que una firma manuscrita bajo la Ley de Firmas Electrónicas en Comercio Global y Nacional (ESIGN) y las leyes estatales aplicables (UETA).\n\nTiene derecho a solicitar una copia en papel de este documento. Para solicitar una copia en papel, comuníquese con Stanton Management al (617) 555-0100 o envíe un correo electrónico a support@stantonmanagement.com.\n\nAl marcar la casilla a continuación, confirma que:\n• Ha leído y comprendido esta divulgación\n• Consentir en el uso de firmas electrónicas\n• Tiene acceso a la tecnología necesaria para ver y firmar electrónicamente\n• Puede imprimir o guardar una copia de este documento',
    TRUE,
    NOW()
  ),
  (
    'esign-disclosure-v1',
    'ht',
    E'W pral siyen dokiman sa a elektwonikman.\n\nLè w kontinye, ou dakò ke siyati elektwonik ou gen menm efè legal ak yon siyati ki ekri ak men anba Lwa sou Siyati Elektwonik nan Komès Global ak Nasyonal (ESIGN) ak lwa eta aplikab yo (UETA).\n\nOu gen dwa mande yon kopi papye dokiman sa a. Pou mande yon kopi papye, kontakte Stanton Management nan (617) 555-0100 oswa voye yon imèl nan support@stantonmanagement.com.\n\nLè w tcheke bwat la anba a, ou konfime ke:\n• Ou li ak konprann divilgasyon sa a\n• Ou konsanti nan itilizasyon siyati elektwonik\n• Ou gen aksè nan teknoloji a ki nesesè pou wè ak siyen elektwonikman\n• Ou ka enprime oswa sove yon kopi dokiman sa a',
    TRUE,
    NOW()
  )
ON CONFLICT (version_key, language) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. signature_capture_in_progress — transient state between capture steps
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signature_capture_in_progress (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_signature_id   UUID        NOT NULL REFERENCES public.packet_signatures(id) ON DELETE CASCADE,
  -- Signer context
  signer_role         TEXT        NOT NULL CHECK (signer_role IN ('tenant', 'stanton')),
  tenant_token        TEXT,  -- null for staff signers
  -- Step tracking
  step                TEXT        NOT NULL CHECK (step IN ('consent', 'identity', 'review', 'signature', 'complete')),
  -- Consent data
  consent_recorded_at TIMESTAMPTZ,
  consent_version     TEXT,
  consent_language    TEXT,
  -- Identity data
  identity_verified_at TIMESTAMPTZ,
  identity_attempts   INTEGER     DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  -- Document review data
  document_reviewed_at TIMESTAMPTZ,
  pages_viewed      INTEGER,
  pdf_page_count    INTEGER,
  original_pdf_path TEXT,
  original_pdf_hash TEXT,
  -- Signature data (captured but not yet applied)
  typed_name        TEXT,
  signature_image_data_url TEXT,
  signature_date    DATE,
  -- Metadata
  ip_address        INET,
  user_agent        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  UNIQUE (packet_signature_id, signer_role, tenant_token)
);

CREATE INDEX idx_capture_in_progress_expires ON public.signature_capture_in_progress (expires_at);
CREATE INDEX idx_capture_in_progress_packet   ON public.signature_capture_in_progress (packet_signature_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. permission seed
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'view_signature_audit')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS policies for signature_capture_in_progress
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.signature_capture_in_progress ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "service_role all on capture_in_progress"
  ON public.signature_capture_in_progress FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Cleanup expired rows (can be run periodically or via cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_capture_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.signature_capture_in_progress 
  WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
