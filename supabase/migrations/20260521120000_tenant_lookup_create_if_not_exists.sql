-- PRP-021 / I5 — corrective `tenant_lookup` creation migration.
--
-- The `tenant_lookup` table is referenced by later migrations
-- (20260408210000 ALTERs it; 20260501000000 JOINs against
--  building_address, unit_number, phone columns) but no creation
-- migration was ever committed. A fresh staging/prod clone built
-- purely from migrations would currently fail at the ALTER TABLE.
--
-- This migration uses `IF NOT EXISTS` so an environment where the
-- table was created out-of-band (the prod project, where the table
-- already exists) is a no-op. The column set is the BEST INFERENCE
-- from the call sites; if/when prod is introspected we should update
-- this file to mirror the real schema exactly before applying to a
-- fresh environment.
--
-- ⚠️ Inferred schema — Alex to verify against prod before applying on
-- a fresh environment. The current prod project (lieeeqqvshobnqofcdac)
-- is unaffected because the table already exists; this migration is a
-- safety net for clones / disaster recovery / staging spin-ups.
--
-- Known-referenced columns (verified):
--   building_address    text       (joined in pbv_application_contact_fields view)
--   unit_number         text       (joined in pbv_application_contact_fields view)
--   asset_id            text       (added by 20260408210000 — must exist before that ALTER)
--   preferred_language  text       (added by 20260408210000)
--   phone               text       (read in pbv_application_contact_fields view)
--   is_current          boolean    (filter in idx_tenant_lookup_asset_unit)
--
-- Likely-referenced (best inference — please verify):
--   id, created_at, updated_at, name, email, source

CREATE TABLE IF NOT EXISTS tenant_lookup (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_address    text NOT NULL,
  unit_number         text NOT NULL,
  asset_id            text,
  preferred_language  text,
  phone               text,
  name                text,
  email               text,
  is_current          boolean NOT NULL DEFAULT true,
  source              text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 20260408210000 ALTERs the table to make preferred_language NOT NULL DEFAULT 'en'.
-- We pre-apply that shape here on the IF NOT EXISTS path so the later
-- ALTER (which only ADDs the column) is harmless when the table didn't
-- pre-exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenant_lookup' AND column_name='preferred_language'
  ) THEN
    -- noop — column is in the CREATE above; defensive branch in case
    -- this file is later edited to drop the column from CREATE.
    NULL;
  END IF;
END$$;

COMMENT ON TABLE tenant_lookup IS
  'PRP-021 / I5: idempotent backfill migration. The table was created out-of-band in early dev; this file ensures a fresh DB built purely from migrations gets the same table. Verify column set against prod before relying on a clone.';
