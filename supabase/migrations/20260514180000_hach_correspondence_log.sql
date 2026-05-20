-- =============================================================================
-- HACH Correspondence Log — Pipeline Dashboard Phase 4
--
-- Tracks all off-portal communication between Stanton and HACH.
-- Inbound/outbound emails, phone calls, portal messages, in-person meetings.
-- =============================================================================

-- ─── 1. Create hach_correspondence_log table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hach_correspondence_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  direction           TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel             TEXT NOT NULL CHECK (channel IN ('email', 'phone', 'portal', 'in_person', 'other')),
  from_party          TEXT,
  to_party            TEXT,
  subject             TEXT,
  body                TEXT,
  occurred_at         TIMESTAMPTZ NOT NULL,
  status              TEXT DEFAULT 'resolved' CHECK (status IN ('awaiting_their_response', 'awaiting_our_response', 'resolved')),
  logged_by           UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  logged_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.hach_correspondence_log IS
  'Off-portal communication log for HACH correspondence. One row per email, phone call, or other contact.';

COMMENT ON COLUMN public.hach_correspondence_log.direction IS
  'inbound = from HACH to Stanton, outbound = from Stanton to HACH';

COMMENT ON COLUMN public.hach_correspondence_log.status IS
  'awaiting_their_response = we need to hear back, awaiting_our_response = HACH waiting on us, resolved = complete';

-- ─── 2. Indexes ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS hcl_app_idx
  ON public.hach_correspondence_log(application_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS hcl_status_idx
  ON public.hach_correspondence_log(status, occurred_at DESC)
  WHERE status != 'resolved';

CREATE INDEX IF NOT EXISTS hcl_logged_by_idx
  ON public.hach_correspondence_log(logged_by, logged_at DESC);

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.hach_correspondence_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on hach_correspondence_log"
  ON public.hach_correspondence_log
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ─── 4. Trigger for updated_at ──────────────────────────────────────────────
-- Note: This table doesn't have updated_at because rows are append-only.
-- Status changes are done via UPDATE, so we track in the row itself.

-- ─── 5. Helper function: last_hach_contact_summary ───────────────────────────
-- Returns the summary for pipeline row display

CREATE OR REPLACE FUNCTION public.get_last_hach_contact_summary(app_id UUID)
RETURNS TABLE (
  days_since_inbound INTEGER,
  last_status TEXT,
  is_awaiting_response BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(DAY FROM NOW() - MAX(occurred_at))::INTEGER as days_since_inbound,
    (SELECT status FROM hach_correspondence_log 
     WHERE application_id = app_id 
     ORDER BY occurred_at DESC LIMIT 1) as last_status,
    EXISTS (
      SELECT 1 FROM hach_correspondence_log 
      WHERE application_id = app_id 
      AND status IN ('awaiting_their_response', 'awaiting_our_response')
    ) as is_awaiting_response
  FROM hach_correspondence_log
  WHERE application_id = app_id
  AND direction = 'inbound';
END;
$$ LANGUAGE plpgsql STABLE;
