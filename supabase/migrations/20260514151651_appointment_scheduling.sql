-- =============================================================================
-- Appointment Scheduling Migration
-- Creates tables for staff availability and tenant appointment booking
-- =============================================================================

-- ─── 1. staff_availability_templates ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_availability_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  weekday         INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slot_minutes    INT NOT NULL DEFAULT 30,
  buffer_minutes  INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sat_staff_idx 
  ON public.staff_availability_templates(staff_id, weekday);

CREATE INDEX IF NOT EXISTS sat_active_idx 
  ON public.staff_availability_templates(staff_id, weekday) 
  WHERE is_active = true;

COMMENT ON TABLE public.staff_availability_templates IS 
  'Weekly recurring availability templates per staff member. 0=Sunday, 6=Saturday.';

-- ─── 2. staff_availability_overrides ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_availability_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  override_date   DATE NOT NULL,
  start_time      TIME,                      -- NULL = closed all day
  end_time        TIME,
  slot_minutes    INT,
  buffer_minutes  INT,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, override_date)
);

CREATE INDEX IF NOT EXISTS sao_staff_date_idx 
  ON public.staff_availability_overrides(staff_id, override_date);

CREATE INDEX IF NOT EXISTS sao_date_idx 
  ON public.staff_availability_overrides(override_date);

COMMENT ON TABLE public.staff_availability_overrides IS 
  'Date-specific availability overrides. NULL start_time means fully closed.';

-- ─── 3. appointments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  staff_id            UUID NOT NULL REFERENCES public.admin_users(id),
  starts_at           TIMESTAMPTZ NOT NULL,
  duration_minutes    INT NOT NULL,
  purpose             TEXT NOT NULL CHECK (purpose IN (
    'sign_documents',
    'inspection_required',
    'intake_help',
    'document_drop',
    'other'
  )),
  status              TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',
    'completed',
    'no_show',
    'cancelled',
    'rescheduled'
  )),
  rescheduled_from_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  tenant_confirmed_at TIMESTAMPTZ,
  created_by          UUID REFERENCES public.admin_users(id),  -- NULL if tenant self-scheduled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS appt_staff_date_idx 
  ON public.appointments(staff_id, starts_at);

CREATE INDEX IF NOT EXISTS appt_app_idx 
  ON public.appointments(application_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS appt_rescheduled_from_idx 
  ON public.appointments(rescheduled_from_id) 
  WHERE rescheduled_from_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS appt_date_range_idx 
  ON public.appointments(starts_at, staff_id) 
  WHERE status NOT IN ('cancelled', 'rescheduled');

COMMENT ON TABLE public.appointments IS 
  'Scheduled appointments between tenants and staff for PBV application processing.';

COMMENT ON COLUMN public.appointments.purpose IS 
  'sign_documents=tenant signing, inspection_required=unit inspection, intake_help=application assistance, document_drop=paper submission';

-- ─── 4. Triggers for updated_at ──────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS set_updated_at_appointments
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER IF NOT EXISTS set_updated_at_templates
  BEFORE UPDATE ON public.staff_availability_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER IF NOT EXISTS set_updated_at_overrides
  BEFORE UPDATE ON public.staff_availability_overrides
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 5. RLS Policies ─────────────────────────────────────────────────────────

ALTER TABLE public.staff_availability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY IF NOT EXISTS service_role_templates ON public.staff_availability_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS service_role_overrides ON public.staff_availability_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS service_role_appointments ON public.appointments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 6. Seed default availability for existing Stanton staff ───────────────────

-- Insert default templates (Mon-Fri, 9am-5pm, 30min slots) for all active Stanton staff
-- Only if they don't already have templates

INSERT INTO public.staff_availability_templates (staff_id, weekday, start_time, end_time, slot_minutes, buffer_minutes, is_active)
SELECT 
  au.id as staff_id,
  wd.weekday,
  '09:00'::time as start_time,
  '17:00'::time as end_time,
  30 as slot_minutes,
  0 as buffer_minutes,
  true as is_active
FROM public.admin_users au
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS wd(weekday)  -- Mon-Fri
WHERE au.user_type = 'stanton_staff' 
  AND au.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.staff_availability_templates sat 
    WHERE sat.staff_id = au.id
  );

-- ─── 7. Permissions seed ─────────────────────────────────────────────────────

INSERT INTO public.permissions (resource, action, description)
VALUES 
  ('scheduling', 'read', 'View appointments and availability'),
  ('scheduling', 'write', 'Create and modify appointments and availability'),
  ('scheduling', 'admin', 'Full admin access to scheduling (manage all staff)')
ON CONFLICT (resource, action) DO NOTHING;

-- Grant scheduling:admin to existing super admins via role_permissions
-- (Super admins can manage all staff availability)

