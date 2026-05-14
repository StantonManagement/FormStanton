-- =============================================================================
-- Application Events — Generalize to Polymorphic Anchor Pattern
--
-- Replaces hard FK full_application_id (UUID → pbv_full_applications)
-- with polymorphic (anchor_type TEXT, anchor_id UUID), making
-- application_events reusable across workflows beyond PBV.
--
-- All existing rows are backfilled:
--   anchor_type = 'pbv_full_application'
--   anchor_id   = full_application_id
--
-- Runs in a single transaction. Idempotent — safe to re-apply.
--
-- ROLLBACK (manual — run only if you need to undo):
-- ─────────────────────────────────────────────────
-- BEGIN;
--   ALTER TABLE application_events
--     ADD COLUMN IF NOT EXISTS full_application_id UUID;
--   UPDATE application_events
--     SET full_application_id = anchor_id
--     WHERE anchor_type = 'pbv_full_application';
--   ALTER TABLE application_events
--     ALTER COLUMN full_application_id SET NOT NULL;
--   ALTER TABLE application_events
--     ADD CONSTRAINT application_events_full_application_id_fkey
--       FOREIGN KEY (full_application_id)
--       REFERENCES pbv_full_applications(id) ON DELETE CASCADE;
--   ALTER TABLE application_events DROP COLUMN IF EXISTS anchor_type;
--   ALTER TABLE application_events DROP COLUMN IF EXISTS anchor_id;
--   DROP INDEX IF EXISTS idx_application_events_anchor;
--   CREATE INDEX idx_application_events_app
--     ON application_events (full_application_id, created_at DESC);
-- COMMIT;
-- =============================================================================

BEGIN;

-- ─── Step 1: Add new anchor columns (nullable initially for backfill) ─────────

ALTER TABLE application_events
  ADD COLUMN IF NOT EXISTS anchor_type TEXT,
  ADD COLUMN IF NOT EXISTS anchor_id   UUID;


-- ─── Step 2: Backfill from full_application_id ────────────────────────────────

UPDATE application_events
SET
  anchor_type = 'pbv_full_application',
  anchor_id   = full_application_id
WHERE anchor_type IS NULL;


-- ─── Step 3: Assert backfill is complete (zero NULL anchor rows) ──────────────

DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM application_events
  WHERE anchor_type IS NULL OR anchor_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION
      'Backfill incomplete: % rows still have NULL anchor_type or anchor_id',
      null_count;
  END IF;
END;
$$;


-- ─── Step 4: Set NOT NULL on anchor columns ───────────────────────────────────

ALTER TABLE application_events
  ALTER COLUMN anchor_type SET NOT NULL,
  ALTER COLUMN anchor_id   SET NOT NULL;


-- ─── Step 5: Add CHECK constraint on anchor_type ─────────────────────────────

ALTER TABLE application_events
  DROP CONSTRAINT IF EXISTS application_events_anchor_type_check;

ALTER TABLE application_events
  ADD CONSTRAINT application_events_anchor_type_check
    CHECK (anchor_type IN ('pbv_full_application'));


-- ─── Step 6: Drop FK constraint on full_application_id ───────────────────────

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'application_events'::regclass
    AND contype = 'f'
    AND conname ILIKE '%full_application_id%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE application_events DROP CONSTRAINT %I', fk_name);
  END IF;
END;
$$;


-- ─── Step 7: Drop full_application_id column ─────────────────────────────────

ALTER TABLE application_events
  DROP COLUMN IF EXISTS full_application_id;


-- ─── Step 8: Drop old index, create new anchor index ─────────────────────────

DROP INDEX IF EXISTS idx_application_events_app;

CREATE INDEX IF NOT EXISTS idx_application_events_anchor
  ON application_events (anchor_type, anchor_id, created_at DESC);


COMMIT;
