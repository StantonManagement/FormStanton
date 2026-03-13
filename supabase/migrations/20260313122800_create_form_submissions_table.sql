create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  form_type text not null,
  tenant_name text,
  building_address text,
  unit_number text,
  form_data jsonb not null,
  photo_urls text[] default '{}'::text[],
  signature_url text,
  language text,
  submitted_at timestamp with time zone default now(),
  reviewed boolean default false,
  reviewed_by text,
  reviewed_at timestamp with time zone,
  admin_notes text,
  constraint form_submissions_form_type_nonempty_chk check (length(btrim(form_type)) > 0)
);

create index if not exists idx_form_submissions_submitted_at
  on public.form_submissions (submitted_at desc);

create index if not exists idx_form_submissions_form_type
  on public.form_submissions (form_type);

alter table public.form_submissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'form_submissions'
      and policyname = 'Allow service role full access to form submissions'
  ) then
    create policy "Allow service role full access to form submissions"
      on public.form_submissions
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;
