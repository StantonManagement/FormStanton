-- ============================================================
-- RBAC Permissions System
-- Replaces binary admin/staff role with full department +
-- role + permission model.
-- ============================================================

-- ------------------------------------------------------------------
-- 1. DEPARTMENTS
-- ------------------------------------------------------------------
create table if not exists public.departments (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  code        text        not null unique,
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  created_by  text        not null default 'system'
);

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at
  before update on public.departments
  for each row execute function public.trigger_set_updated_at();

alter table public.departments enable row level security;

create policy "departments_select_authenticated"
  on public.departments for select to authenticated using (true);

create policy "departments_all_service_role"
  on public.departments for all to service_role using (true) with check (true);

-- ------------------------------------------------------------------
-- 2. PERMISSIONS  (resource × action pairs)
-- ------------------------------------------------------------------
create table if not exists public.permissions (
  id          uuid  primary key default gen_random_uuid(),
  resource    text  not null,
  action      text  not null check (action in ('read', 'write', 'delete', 'admin')),
  description text,
  unique (resource, action)
);

alter table public.permissions enable row level security;

create policy "permissions_select_authenticated"
  on public.permissions for select to authenticated using (true);

create policy "permissions_all_service_role"
  on public.permissions for all to service_role using (true) with check (true);

-- ------------------------------------------------------------------
-- 3. ROLES
-- ------------------------------------------------------------------
create table if not exists public.roles (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  code          text        not null unique,
  description   text,
  department_id uuid        references public.departments(id) on delete set null,
  is_system     boolean     not null default false,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  created_by    text        not null default 'system'
);

drop trigger if exists set_roles_updated_at on public.roles;
create trigger set_roles_updated_at
  before update on public.roles
  for each row execute function public.trigger_set_updated_at();

alter table public.roles enable row level security;

create policy "roles_select_authenticated"
  on public.roles for select to authenticated using (true);

create policy "roles_all_service_role"
  on public.roles for all to service_role using (true) with check (true);

-- ------------------------------------------------------------------
-- 4. ROLE_PERMISSIONS  (join table)
-- ------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

alter table public.role_permissions enable row level security;

create policy "role_permissions_select_authenticated"
  on public.role_permissions for select to authenticated using (true);

create policy "role_permissions_all_service_role"
  on public.role_permissions for all to service_role using (true) with check (true);

-- ------------------------------------------------------------------
-- 5. USER_ROLES  (join table — user → role assignments)
-- ------------------------------------------------------------------
create table if not exists public.user_roles (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.admin_users(id) on delete cascade,
  role_id     uuid        not null references public.roles(id) on delete cascade,
  assigned_by uuid        references public.admin_users(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  unique (user_id, role_id)
);

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role_id on public.user_roles(role_id);

alter table public.user_roles enable row level security;

create policy "user_roles_select_authenticated"
  on public.user_roles for select to authenticated using (true);

create policy "user_roles_all_service_role"
  on public.user_roles for all to service_role using (true) with check (true);

-- ------------------------------------------------------------------
-- 6. ALTER admin_users — add department_id
-- ------------------------------------------------------------------
alter table public.admin_users
  add column if not exists department_id uuid references public.departments(id) on delete set null;

-- Note: admin_users.role column is preserved during migration.
-- It will be dropped in a follow-up migration after all users
-- have been assigned roles via the migration step below.
-- This keeps the app running during the transition.
