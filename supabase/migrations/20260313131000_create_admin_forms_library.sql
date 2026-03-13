create table if not exists public.admin_forms_library (
  form_id integer primary key,
  title text not null,
  department text not null check (department in ('property_management', 'maintenance', 'compliance', 'finance')),
  description text not null,
  path text,
  content text,
  is_current boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  created_by text not null default 'system'
);

create index if not exists idx_admin_forms_library_department
  on public.admin_forms_library (department)
  where is_current = true;

alter table public.admin_forms_library enable row level security;

create policy "admin_forms_library_select_authenticated"
  on public.admin_forms_library
  for select
  to authenticated
  using (true);

create policy "admin_forms_library_insert_authenticated"
  on public.admin_forms_library
  for insert
  to authenticated
  with check (true);

create policy "admin_forms_library_update_authenticated"
  on public.admin_forms_library
  for update
  to authenticated
  using (true)
  with check (true);

drop trigger if exists set_admin_forms_library_updated_at on public.admin_forms_library;

create trigger set_admin_forms_library_updated_at
before update on public.admin_forms_library
for each row
execute function public.trigger_set_updated_at();
