-- =============================================================================
-- Application Events — Index on actor_user_id
--
-- Several queries in lib/work/queries.ts filter application_events by
-- actor_user_id (often combined with created_at ordering):
--   - getFreshActivity
--   - getStaleTouched
--   - getRecentlyCompleted
--   - getRecentOverrides (indirectly)
--   - getWorkloadByReviewer
--
-- Before this migration, those filters caused a sequential scan. Fine at
-- current scale (~40 rows), but it would degrade linearly as the event
-- table grows.
--
-- Composite index (actor_user_id, created_at DESC) supports both:
--   - WHERE actor_user_id = ? (selectivity)
--   - ORDER BY created_at DESC LIMIT N (sort skip)
--
-- CREATE INDEX CONCURRENTLY would be ideal in production, but Supabase
-- migrations run in a transaction so CONCURRENTLY is disallowed. The
-- table is small so a regular CREATE INDEX is acceptable here.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_application_events_actor_created
  ON application_events (actor_user_id, created_at DESC);
