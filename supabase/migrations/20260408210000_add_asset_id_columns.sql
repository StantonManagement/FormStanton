-- Add asset_id to tenant_lookup and project_units for format-agnostic building joins
-- See docs/asset-id-migration-prp.md for full rationale

ALTER TABLE tenant_lookup ADD COLUMN asset_id TEXT;
ALTER TABLE tenant_lookup ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en';

ALTER TABLE project_units ADD COLUMN asset_id TEXT;

-- Indexes for the primary join pattern: asset_id + unit_number
CREATE INDEX idx_tenant_lookup_asset_unit ON tenant_lookup(asset_id, unit_number) WHERE is_current = true;
CREATE INDEX idx_project_units_asset_id ON project_units(asset_id);
