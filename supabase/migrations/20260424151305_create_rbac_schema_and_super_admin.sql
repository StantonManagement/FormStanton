-- =====================================================================
-- RBAC schema: departments, roles, permissions, role_permissions, user_roles
-- + admin_users.is_super_admin and admin_users.department_id
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  CONSTRAINT permissions_resource_action_unique UNIQUE (resource, action)
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles       ENABLE ROW LEVEL SECURITY;

-- Seed the full permissions matrix (resource × action)
INSERT INTO public.permissions (resource, action) VALUES
  ('home','read'),('home','write'),('home','delete'),('home','admin'),
  ('compliance','read'),('compliance','write'),('compliance','delete'),('compliance','admin'),
  ('projects','read'),('projects','write'),('projects','delete'),('projects','admin'),
  ('pbv-preapps','read'),('pbv-preapps','write'),('pbv-preapps','delete'),('pbv-preapps','admin'),
  ('pbv-full-applications','read'),('pbv-full-applications','write'),('pbv-full-applications','delete'),('pbv-full-applications','admin'),
  ('lobby','read'),('lobby','write'),('lobby','delete'),('lobby','admin'),
  ('phone-entry','read'),('phone-entry','write'),('phone-entry','delete'),('phone-entry','admin'),
  ('appfolio-queue','read'),('appfolio-queue','write'),('appfolio-queue','delete'),('appfolio-queue','admin'),
  ('scan-import','read'),('scan-import','write'),('scan-import','delete'),('scan-import','admin'),
  ('form-submissions','read'),('form-submissions','write'),('form-submissions','delete'),('form-submissions','admin'),
  ('onboarding','read'),('onboarding','write'),('onboarding','delete'),('onboarding','admin'),
  ('reimbursements','read'),('reimbursements','write'),('reimbursements','delete'),('reimbursements','admin'),
  ('forms-library','read'),('forms-library','write'),('forms-library','delete'),('forms-library','admin'),
  ('tow-list','read'),('tow-list','write'),('tow-list','delete'),('tow-list','admin'),
  ('audit-log','read'),('audit-log','write'),('audit-log','delete'),('audit-log','admin'),
  ('user-management','read'),('user-management','write'),('user-management','delete'),('user-management','admin'),
  ('role-management','read'),('role-management','write'),('role-management','delete'),('role-management','admin')
ON CONFLICT (resource, action) DO NOTHING;

-- Make Alex super admin
UPDATE public.admin_users SET is_super_admin = true WHERE username = 'aks@stantoncap.com';
