-- Seed workflow-aligned system roles. All composable (users can hold multiple).
INSERT INTO public.roles (name, code, description, is_system) VALUES
  ('Front Desk',         'front_desk',         'Lobby & front-desk staff (permit distribution, phone vehicle entry, tow list)', true),
  ('Field Operations',   'field_ops',          'Inspections, projects, scan import', true),
  ('Back Office',        'back_office',        'Form submissions, onboarding, reimbursements, AppFolio queue', true),
  ('Program Compliance', 'program_compliance', 'PBV pre-apps and full applications', true),
  ('HR',                 'hr',                 'Reimbursements oversight, audit log', true),
  ('Read-only',          'read_only',          'Read access across operational surfaces (no user/role management)', true)
ON CONFLICT (code) DO NOTHING;

-- Front Desk
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'front_desk'
  AND (p.resource, p.action) IN (
    ('home','read'),
    ('lobby','read'),('lobby','write'),
    ('phone-entry','read'),('phone-entry','write'),
    ('tow-list','read'),
    ('forms-library','read')
  )
ON CONFLICT DO NOTHING;

-- Field Operations
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'field_ops'
  AND (p.resource, p.action) IN (
    ('home','read'),
    ('compliance','read'),('compliance','write'),
    ('projects','read'),('projects','write'),
    ('scan-import','read'),('scan-import','write'),
    ('forms-library','read')
  )
ON CONFLICT DO NOTHING;

-- Back Office
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'back_office'
  AND (p.resource, p.action) IN (
    ('home','read'),
    ('form-submissions','read'),('form-submissions','write'),
    ('onboarding','read'),('onboarding','write'),
    ('reimbursements','read'),('reimbursements','write'),
    ('appfolio-queue','read'),('appfolio-queue','write'),
    ('forms-library','read')
  )
ON CONFLICT DO NOTHING;

-- Program Compliance
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'program_compliance'
  AND (p.resource, p.action) IN (
    ('home','read'),
    ('pbv-preapps','read'),('pbv-preapps','write'),('pbv-preapps','delete'),
    ('pbv-full-applications','read'),('pbv-full-applications','write'),('pbv-full-applications','delete'),
    ('compliance','read'),
    ('forms-library','read')
  )
ON CONFLICT DO NOTHING;

-- HR
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'hr'
  AND (p.resource, p.action) IN (
    ('home','read'),
    ('reimbursements','read'),('reimbursements','write'),('reimbursements','delete'),
    ('forms-library','read'),
    ('audit-log','read')
  )
ON CONFLICT DO NOTHING;

-- Read-only (read across all operational surfaces except user/role management)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.code = 'read_only'
  AND p.action = 'read'
  AND p.resource NOT IN ('user-management','role-management')
ON CONFLICT DO NOTHING;
