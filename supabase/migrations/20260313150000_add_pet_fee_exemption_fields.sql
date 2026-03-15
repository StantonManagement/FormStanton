-- Add pet fee exemption fields to form_submissions table
alter table public.form_submissions 
add column if not exists exemption_reason text,
add column if not exists exemption_documents text[] default '{}'::text[],
add column if not exists exemption_status text default 'pending',
add column if not exists exemption_reviewed_by text,
add column if not exists exemption_reviewed_at timestamp with time zone,
add column if not exists exemption_notes text;

-- Add constraint for exemption status
alter table public.form_submissions 
add constraint form_submissions_exemption_status_chk 
check (exemption_status in ('pending', 'approved', 'denied', 'more_info_needed'));

-- Add index for exemption status queries
create index if not exists idx_form_submissions_exemption_status 
on public.form_submissions (exemption_status);

-- Add index for exemption reason queries
create index if not exists idx_form_submissions_exemption_reason 
on public.form_submissions (exemption_reason);

-- Add pet fee exemption fields to submissions table (for existing tenant records)
alter table public.submissions 
add column if not exists exemption_reason text,
add column if not exists exemption_documents text[] default '{}'::text[],
add column if not exists exemption_status text default 'pending',
add column if not exists exemption_reviewed_by text,
add column if not exists exemption_reviewed_at timestamp with time zone,
add column if not exists exemption_notes text,
add column if not exists has_fee_exemption boolean generated always as (case when exemption_status = 'approved' then true else false end) stored;

-- Add constraint for exemption status in submissions table
alter table public.submissions 
add constraint submissions_exemption_status_chk 
check (exemption_status in ('pending', 'approved', 'denied', 'more_info_needed', null));

-- Add index for exemption status queries in submissions
create index if not exists idx_submissions_exemption_status 
on public.submissions (exemption_status);

-- Add index for has_fee_exemption
create index if not exists idx_submissions_has_fee_exemption 
on public.submissions (has_fee_exemption);

-- Add index for exemption reason queries in submissions
create index if not exists idx_submissions_exemption_reason 
on public.submissions (exemption_reason);
