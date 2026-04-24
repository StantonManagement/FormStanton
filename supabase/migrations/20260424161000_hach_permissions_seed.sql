-- HACH RBAC Permissions Seed
-- Inserts hach.review and hach.users permissions, creates hach_admin and
-- hach_reviewer system roles, and assigns permissions to roles.
-- Idempotent: ON CONFLICT DO NOTHING throughout.
--
-- Note: action values are constrained to ('read','write','delete','admin')
-- per the existing permissions table CHECK constraint. The PRD's
-- "hach.users.manage" maps to resource='hach.users', action='admin'.
--
-- Rollback:
--   DELETE FROM public.role_permissions WHERE role_id IN (SELECT id FROM public.roles WHERE code IN ('hach_admin','hach_reviewer'));
--   DELETE FROM public.roles WHERE code IN ('hach_admin','hach_reviewer');
--   DELETE FROM public.permissions WHERE resource IN ('hach.review','hach.users');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. HACH permissions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.permissions (resource, action, description)
VALUES
  ('hach.review', 'read',  'View HACH review queue and application packets'),
  ('hach.review', 'write', 'Approve, reject, and action documents in HACH review'),
  ('hach.users',  'admin', 'Manage HACH user accounts — invite, deactivate, reset password')
ON CONFLICT (resource, action) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HACH roles
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.roles (name, code, description, is_system)
VALUES
  ('HACH Admin',    'hach_admin',    'HACH administrator — review packets + manage HACH users', true),
  ('HACH Reviewer', 'hach_reviewer', 'HACH reviewer — view and action application packets',    true)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Assign permissions to roles
-- ─────────────────────────────────────────────────────────────────────────────

-- hach_reviewer: hach.review read + write
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'hach_reviewer'
  AND p.resource = 'hach.review'
  AND p.action IN ('read', 'write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- hach_admin: hach.review read + write + hach.users admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'hach_admin'
  AND (
    (p.resource = 'hach.review' AND p.action IN ('read', 'write'))
    OR (p.resource = 'hach.users' AND p.action = 'admin')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
