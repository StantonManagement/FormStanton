-- Create reimbursement_requests table
create table reimbursement_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),

  -- Language
  language text,

  -- Tenant info
  tenant_name text not null,
  building_address text not null,
  unit_number text not null,
  phone text not null,
  email text not null,
  date_submitted date not null,

  -- Expense details
  expenses jsonb not null,
  total_amount numeric(10,2) not null,
  payment_preference text,
  urgency text default 'normal',

  -- Attachments
  receipt_files text[],

  -- Signature
  tenant_signature text,
  signature_date date,

  -- Office use
  status text default 'pending' check (status in ('pending', 'approved', 'denied')),
  office_notes text,
  office_amount numeric(10,2),
  processed_by text,
  processed_date date,

  -- Audit
  ip_address text,
  user_agent text
);

-- Enable RLS
alter table reimbursement_requests enable row level security;

-- Allow public (anon) inserts
create policy "Allow public inserts on reimbursement_requests"
on reimbursement_requests for insert
to anon
with check (true);

-- Allow authenticated reads
create policy "Allow authenticated reads on reimbursement_requests"
on reimbursement_requests for select
to authenticated
using (true);

-- Allow authenticated updates (for office use fields)
create policy "Allow authenticated updates on reimbursement_requests"
on reimbursement_requests for update
to authenticated
using (true)
with check (true);
