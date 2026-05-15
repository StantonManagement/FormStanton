-- PRD-29: Staff-assisted mode audit column
-- Adds assisted_by_staff_user_id to pbv_signature_events.
-- When a staff member fills the intake on behalf of a tenant, every signature event
-- during that session is tagged with the assisting staff member's admin_users.id.
-- Nullable: NULL means no staff assistance (normal self-service session).
-- Apply after: 20260515020000_pbv_signature_events.sql

ALTER TABLE public.pbv_signature_events
  ADD COLUMN IF NOT EXISTS assisted_by_staff_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pbv_signature_events.assisted_by_staff_user_id IS
  'Set when device_owner = ''staff_assisted''. References admin_users.id of the staff member '
  'who initiated the assisted session. NULL for unassisted signatures.';

CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_assisted_by
  ON public.pbv_signature_events (assisted_by_staff_user_id)
  WHERE assisted_by_staff_user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK INSTRUCTIONS
-- ALTER TABLE public.pbv_signature_events DROP COLUMN IF EXISTS assisted_by_staff_user_id;
-- ─────────────────────────────────────────────────────────────────────────────
