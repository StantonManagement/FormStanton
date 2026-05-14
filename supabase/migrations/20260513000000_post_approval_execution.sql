-- Post-Approval Execution Migration
-- Creates signing packet infrastructure for PBV applications
-- Per PRD: https://docs.stanton-management.com/post-approval-execution_prd_2026-05-13

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. signing_packet_templates — configurable checklist templates
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signing_packet_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  TEXT        NOT NULL UNIQUE,
  display_label TEXT        NOT NULL,
  signatures    JSONB       NOT NULL,  -- [{ slug, label, party, required, conditional_on?, plain_language_description? }]
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: HUD standard set as `default_pbv`
INSERT INTO public.signing_packet_templates (template_key, display_label, signatures)
VALUES (
  'default_pbv',
  'PBV — HUD Standard Set',
  '[
    {"slug":"lease","label":"Residential Lease","party":"tenant_and_stanton","required":true,"plain_language_description":"The agreement between you and Stanton for renting this unit."},
    {"slug":"tenancy_addendum","label":"HUD Tenancy Addendum (52641-A)","party":"tenant_and_stanton","required":true,"plain_language_description":"A federal addendum that protects your rights as a tenant under the housing voucher program."},
    {"slug":"lead_paint","label":"Lead-Based Paint Disclosure","party":"tenant","required":true,"conditional_on":{"property_field":"year_built","operator":"<","value":1978,"default_when_null":"required"},"plain_language_description":"Required when the building was built before 1978. Discloses any known lead-based paint in the unit."},
    {"slug":"vawa","label":"VAWA Notice (HUD 5380)","party":"tenant","required":true,"plain_language_description":"A federal notice about your rights if you have experienced domestic violence."},
    {"slug":"hap_contract","label":"HAP Contract (HUD 52530)","party":"stanton_and_hach","required":true,"plain_language_description":"The contract between Stanton and the housing authority that triggers rent payments."},
    {"slug":"move_in_inspection","label":"Move-In Inspection (HUD 52580)","party":"tenant_and_stanton","required":true,"plain_language_description":"Documents the condition of the unit on the day you move in."}
  ]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. properties — building metadata (already exists, but we need to ensure it has the right structure)
-- ─────────────────────────────────────────────────────────────────────────────
-- Note: properties table already exists with 41 rows. We'll add required_addenda if missing.
DO $$
BEGIN
  -- Check if required_addenda column exists, add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'required_addenda'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN required_addenda JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  
  -- Check if year_built column exists, add if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'properties' AND column_name = 'year_built'
  ) THEN
    ALTER TABLE public.properties ADD COLUMN year_built INTEGER;
  END IF;
  
  -- Add indexes if missing
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'properties' AND indexname = 'idx_properties_address') THEN
    CREATE INDEX idx_properties_address ON public.properties (building_address);
  END IF;
END $$;

-- NO SEED. Properties table should remain as-is per PRD requirements.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. signing_packets — one per application after HACH approval
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signing_packets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL UNIQUE
                              REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  template_key    TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  executed_at     TIMESTAMPTZ,
  executed_by     UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  notes           TEXT
);

CREATE INDEX idx_signing_packets_app      ON public.signing_packets (application_id);
CREATE INDEX idx_signing_packets_executed ON public.signing_packets (executed_at DESC NULLS LAST);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. packet_signatures — one row per required signature
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.packet_signatures (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id                   UUID        NOT NULL REFERENCES public.signing_packets(id) ON DELETE CASCADE,
  document_slug               TEXT        NOT NULL,
  document_label              TEXT        NOT NULL,
  signing_party               TEXT        NOT NULL CHECK (signing_party IN ('tenant', 'stanton', 'hach', 'tenant_and_stanton', 'stanton_and_hach')),
  is_required                 BOOLEAN     NOT NULL DEFAULT TRUE,
  is_template_default         BOOLEAN     NOT NULL DEFAULT TRUE,
  status                      TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sent', 'signed', 'waived', 'executed')),
  sent_at                     TIMESTAMPTZ,
  sent_by                     UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  signed_at                   TIMESTAMPTZ,
  signed_pdf_path             TEXT,
  signed_pdf_uploaded_by      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  signed_pdf_uploaded_by_role TEXT        CHECK (signed_pdf_uploaded_by_role IS NULL
                                             OR signed_pdf_uploaded_by_role IN ('tenant', 'stanton', 'hach')),
  signature_method            TEXT        CHECK (signature_method IS NULL
                                             OR signature_method IN ('wet_upload', 'in_app')),
  waived_reason               TEXT,
  notes                       TEXT,  -- includes hap_initiation_direction when applicable
  plain_language_description  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packet_signatures_packet ON public.packet_signatures (packet_id);
CREATE INDEX idx_packet_signatures_status ON public.packet_signatures (status);
CREATE INDEX idx_packet_signatures_party  ON public.packet_signatures (signing_party);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. pipeline stage enum: add 'executed' to pbv_full_applications.stage
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop and recreate the stage constraint to include 'executed'
ALTER TABLE public.pbv_full_applications DROP CONSTRAINT IF EXISTS pbv_stage_check;
ALTER TABLE public.pbv_full_applications 
  ADD CONSTRAINT pbv_stage_check 
  CHECK (stage = ANY (ARRAY['pre_app'::text, 'intake'::text, 'stanton_review'::text, 'submitted_to_hach'::text, 'hach_review'::text, 'approved'::text, 'denied'::text, 'withdrawn'::text, 'executed'::text]));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. permission seed
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'execute_hap')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS policies
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.signing_packet_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signing_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packet_signatures ENABLE ROW LEVEL SECURITY;

-- Service role full access policies
CREATE POLICY "service_role full access on signing_packet_templates"
  ON public.signing_packet_templates
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "service_role full access on signing_packets"
  ON public.signing_packets
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "service_role full access on packet_signatures"
  ON public.packet_signatures
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Storage bucket for signed PDFs (will be created separately if needed)
-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket: signing-packets
-- Path pattern: {application_id}/{signature_id}/{revision}_{original_filename}
