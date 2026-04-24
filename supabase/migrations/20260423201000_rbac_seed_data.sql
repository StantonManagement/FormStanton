-- ============================================================
-- RBAC Seed Data
-- Departments, all permission rows, default system roles,
-- and migration of existing admin_users to roles.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. DEPARTMENTS
-- ------------------------------------------------------------------
insert into public.departments (name, code, description) values
  ('Operations',      'operations',      'Front-desk, lobby, and day-to-day property operations'),
  ('Compliance',      'compliance',      'Compliance audits, projects, and tenant document review'),
  ('Administration',  'administration',  'System administration, user management, and reporting')
on conflict (code) do nothing;

-- ------------------------------------------------------------------
-- 2. PERMISSIONS  (16 resources × 4 actions = 64 rows)
-- ------------------------------------------------------------------
insert into public.permissions (resource, action, description) values
  -- home
  ('home',              'read',   'View the home dashboard'),
  ('home',              'write',  'Unused — reserved'),
  ('home',              'delete', 'Unused — reserved'),
  ('home',              'admin',  'Admin access to home'),
  -- compliance
  ('compliance',        'read',   'View compliance matrix and building data'),
  ('compliance',        'write',  'Update compliance records, verify documents'),
  ('compliance',        'delete', 'Delete compliance documents and records'),
  ('compliance',        'admin',  'Full admin access to compliance module'),
  -- projects
  ('projects',          'read',   'View projects and unit task status'),
  ('projects',          'write',  'Create and update projects and tasks'),
  ('projects',          'delete', 'Delete projects and task completions'),
  ('projects',          'admin',  'Full admin access to projects module'),
  -- pbv-preapps
  ('pbv-preapps',       'read',   'View PBV pre-application submissions'),
  ('pbv-preapps',       'write',  'Update PBV pre-application records'),
  ('pbv-preapps',       'delete', 'Delete PBV pre-application records'),
  ('pbv-preapps',       'admin',  'Full admin access to PBV pre-apps'),
  -- lobby
  ('lobby',             'read',   'View lobby permit workflow'),
  ('lobby',             'write',  'Process permits, mark pickup, run intake'),
  ('lobby',             'delete', 'Undo permit actions'),
  ('lobby',             'admin',  'Full admin access to lobby module'),
  -- phone-entry
  ('phone-entry',       'read',   'View phone vehicle entry records'),
  ('phone-entry',       'write',  'Create and update phone vehicle entries'),
  ('phone-entry',       'delete', 'Delete phone vehicle entries'),
  ('phone-entry',       'admin',  'Full admin access to phone entry module'),
  -- appfolio-queue
  ('appfolio-queue',    'read',   'View AppFolio upload queue'),
  ('appfolio-queue',    'write',  'Mark items uploaded in AppFolio'),
  ('appfolio-queue',    'delete', 'Unused — reserved'),
  ('appfolio-queue',    'admin',  'Full admin access to AppFolio queue'),
  -- scan-import
  ('scan-import',       'read',   'View scan import records'),
  ('scan-import',       'write',  'Upload and process scans'),
  ('scan-import',       'delete', 'Delete scan records'),
  ('scan-import',       'admin',  'Full admin access to scan import'),
  -- form-submissions
  ('form-submissions',  'read',   'View form submissions'),
  ('form-submissions',  'write',  'Update and process form submissions'),
  ('form-submissions',  'delete', 'Delete form submissions'),
  ('form-submissions',  'admin',  'Full admin access to form submissions'),
  -- onboarding
  ('onboarding',        'read',   'View onboarding submissions'),
  ('onboarding',        'write',  'Update onboarding submissions'),
  ('onboarding',        'delete', 'Delete onboarding submissions'),
  ('onboarding',        'admin',  'Full admin access to onboarding'),
  -- reimbursements
  ('reimbursements',    'read',   'View reimbursement requests'),
  ('reimbursements',    'write',  'Process and update reimbursement requests'),
  ('reimbursements',    'delete', 'Delete reimbursement requests'),
  ('reimbursements',    'admin',  'Full admin access to reimbursements'),
  -- forms-library
  ('forms-library',     'read',   'View forms library'),
  ('forms-library',     'write',  'Edit forms library entries'),
  ('forms-library',     'delete', 'Delete forms library entries'),
  ('forms-library',     'admin',  'Full admin access to forms library'),
  -- tow-list
  ('tow-list',          'read',   'View tow list'),
  ('tow-list',          'write',  'Add and update tow entries'),
  ('tow-list',          'delete', 'Delete tow entries'),
  ('tow-list',          'admin',  'Full admin access to tow list'),
  -- audit-log
  ('audit-log',         'read',   'View audit log'),
  ('audit-log',         'write',  'Unused — audit log is append-only'),
  ('audit-log',         'delete', 'Unused — reserved'),
  ('audit-log',         'admin',  'Full admin access to audit log'),
  -- user-management
  ('user-management',   'read',   'View staff user list'),
  ('user-management',   'write',  'Create and update staff users'),
  ('user-management',   'delete', 'Deactivate staff users'),
  ('user-management',   'admin',  'Full admin access including role assignment'),
  -- role-management
  ('role-management',   'read',   'View roles and permissions'),
  ('role-management',   'write',  'Create and update roles'),
  ('role-management',   'delete', 'Delete custom roles'),
  ('role-management',   'admin',  'Full admin access to role and department management')
on conflict (resource, action) do nothing;

-- ------------------------------------------------------------------
-- 3. SYSTEM ROLES
-- ------------------------------------------------------------------

-- Super Admin (cross-department, all permissions)
insert into public.roles (name, code, description, department_id, is_system) values
  ('Super Admin', 'super_admin', 'Full access to all features across all departments', null, true)
on conflict (code) do nothing;

-- Compliance Manager (compliance department, full CRUD on compliance features)
insert into public.roles (name, code, description, department_id, is_system)
select
  'Compliance Manager',
  'compliance_manager',
  'Full access to compliance, projects, PBV pre-apps, and tow list',
  d.id,
  true
from public.departments d
where d.code = 'compliance'
on conflict (code) do nothing;

-- Compliance Reviewer (compliance department, read+write only)
insert into public.roles (name, code, description, department_id, is_system)
select
  'Compliance Reviewer',
  'compliance_reviewer',
  'Read and write access to compliance and projects; read-only audit log',
  d.id,
  true
from public.departments d
where d.code = 'compliance'
on conflict (code) do nothing;

-- Lobby Staff (operations department)
insert into public.roles (name, code, description, department_id, is_system)
select
  'Lobby Staff',
  'lobby_staff',
  'Lobby permit workflow, phone entry, and read-only compliance',
  d.id,
  true
from public.departments d
where d.code = 'operations'
on conflict (code) do nothing;

-- Operations Staff (operations department)
insert into public.roles (name, code, description, department_id, is_system)
select
  'Operations Staff',
  'operations_staff',
  'AppFolio queue, scan import, form submissions, onboarding, reimbursements',
  d.id,
  true
from public.departments d
where d.code = 'operations'
on conflict (code) do nothing;

-- Viewer (cross-department, read-only everything)
insert into public.roles (name, code, description, department_id, is_system) values
  ('Viewer', 'viewer', 'Read-only access to all modules', null, true)
on conflict (code) do nothing;

-- ------------------------------------------------------------------
-- 4. ROLE_PERMISSIONS — Super Admin gets everything
-- ------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r, public.permissions p
where r.code = 'super_admin'
on conflict do nothing;

-- ------------------------------------------------------------------
-- 5. ROLE_PERMISSIONS — Compliance Manager
-- ------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'compliance_manager'
  and (
    (p.resource = 'home'         and p.action = 'read')  or
    (p.resource = 'compliance'   and p.action in ('read','write','delete','admin')) or
    (p.resource = 'projects'     and p.action in ('read','write','delete','admin')) or
    (p.resource = 'pbv-preapps'  and p.action in ('read','write','delete','admin')) or
    (p.resource = 'tow-list'     and p.action in ('read','write','delete','admin')) or
    (p.resource = 'audit-log'    and p.action = 'read') or
    (p.resource = 'lobby'        and p.action = 'read') or
    (p.resource = 'forms-library' and p.action in ('read','write'))
  )
on conflict do nothing;

-- ------------------------------------------------------------------
-- 6. ROLE_PERMISSIONS — Compliance Reviewer
-- ------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'compliance_reviewer'
  and (
    (p.resource = 'home'         and p.action = 'read') or
    (p.resource = 'compliance'   and p.action in ('read','write')) or
    (p.resource = 'projects'     and p.action in ('read','write')) or
    (p.resource = 'pbv-preapps'  and p.action = 'read') or
    (p.resource = 'tow-list'     and p.action = 'read') or
    (p.resource = 'audit-log'    and p.action = 'read') or
    (p.resource = 'forms-library' and p.action = 'read')
  )
on conflict do nothing;

-- ------------------------------------------------------------------
-- 7. ROLE_PERMISSIONS — Lobby Staff
-- ------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'lobby_staff'
  and (
    (p.resource = 'home'          and p.action = 'read') or
    (p.resource = 'lobby'         and p.action in ('read','write','delete')) or
    (p.resource = 'phone-entry'   and p.action in ('read','write')) or
    (p.resource = 'compliance'    and p.action = 'read') or
    (p.resource = 'form-submissions' and p.action = 'read')
  )
on conflict do nothing;

-- ------------------------------------------------------------------
-- 8. ROLE_PERMISSIONS — Operations Staff
-- ------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'operations_staff'
  and (
    (p.resource = 'home'             and p.action = 'read') or
    (p.resource = 'appfolio-queue'   and p.action in ('read','write')) or
    (p.resource = 'scan-import'      and p.action in ('read','write')) or
    (p.resource = 'form-submissions' and p.action in ('read','write')) or
    (p.resource = 'onboarding'       and p.action in ('read','write')) or
    (p.resource = 'reimbursements'   and p.action in ('read','write')) or
    (p.resource = 'forms-library'    and p.action = 'read') or
    (p.resource = 'compliance'       and p.action = 'read')
  )
on conflict do nothing;

-- ------------------------------------------------------------------
-- 9. ROLE_PERMISSIONS — Viewer (read-only everything)
-- ------------------------------------------------------------------
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'viewer'
  and p.action = 'read'
on conflict do nothing;

-- ------------------------------------------------------------------
-- 10. MIGRATE existing admin_users to roles
--     admin → super_admin
--     staff → viewer (safe default; upgrade manually)
-- ------------------------------------------------------------------
insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.admin_users u
cross join public.roles r
where u.role = 'admin'
  and r.code = 'super_admin'
  and u.is_active = true
on conflict (user_id, role_id) do nothing;

insert into public.user_roles (user_id, role_id)
select u.id, r.id
from public.admin_users u
cross join public.roles r
where u.role = 'staff'
  and r.code = 'viewer'
  and u.is_active = true
on conflict (user_id, role_id) do nothing;
