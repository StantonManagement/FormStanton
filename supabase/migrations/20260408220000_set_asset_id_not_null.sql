-- project_units.asset_id is now always populated by activate/POST routes
ALTER TABLE project_units ALTER COLUMN asset_id SET NOT NULL;
-- tenant_lookup.asset_id left nullable: test data and future unknown buildings may lack asset_id
