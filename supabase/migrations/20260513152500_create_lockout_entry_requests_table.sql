create table if not exists public.lockout_entry_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Tenant Information
  tenant_name text not null,
  building_address text not null,
  unit_number text not null,
  phone text,
  
  -- Lockout Details
  lockout_date date not null,
  lockout_time time not null,
  notes text,
  
  -- Office Response
  entry_provided boolean default false,
  staff_member text,
  
  -- Fee Information
  lockout_fee numeric(10,2),
  fee_collected boolean default false,
  payment_method text check (payment_method in ('cash', 'check', 'credit', 'charge_account')),
  
  -- Signature & Metadata
  signature_data text,
  language text default 'en',
  status text default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  
  -- Tracking
  created_by uuid references auth.users(id),
  completed_at timestamp with time zone,
  completed_by uuid references auth.users(id)
);

-- Indexes
create index if not exists idx_lockout_entry_requests_created_at
  on public.lockout_entry_requests (created_at desc);

create index if not exists idx_lockout_entry_requests_building
  on public.lockout_entry_requests (building_address);

create index if not exists idx_lockout_entry_requests_status
  on public.lockout_entry_requests (status);

create index if not exists idx_lockout_entry_requests_lockout_date
  on public.lockout_entry_requests (lockout_date desc);

-- Updated at trigger
create or replace function trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.lockout_entry_requests;
create trigger set_updated_at
  before update on public.lockout_entry_requests
  for each row
  execute function trigger_set_updated_at();

-- RLS
alter table public.lockout_entry_requests enable row level security;

-- Service role policy
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lockout_entry_requests'
      and policyname = 'Allow service role full access to lockout entry requests'
  ) then
    create policy "Allow service role full access to lockout entry requests"
      on public.lockout_entry_requests
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

-- Admin read policy
drop policy if exists "Allow admin users to read lockout entry requests" on public.lockout_entry_requests;
create policy "Allow admin users to read lockout entry requests"
  on public.lockout_entry_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid()
        and (role = 'admin' or role = 'super_admin')
    )
  );
