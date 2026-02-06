-- Create submissions table
create table submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),

  -- Resident info
  language text,
  full_name text,
  phone text,
  email text,
  phone_is_new boolean,
  building_address text,
  unit_number text,

  -- Pet section
  has_pets boolean,
  pet_type text,
  pet_name text,
  pet_breed text,
  pet_weight integer,
  pet_color text,
  pet_spayed boolean,
  pet_vaccinations_current boolean,
  pet_vaccination_file text,
  pet_photo_file text,
  pet_signature text,
  pet_signature_date date,

  -- Insurance section
  has_insurance boolean,
  insurance_provider text,
  insurance_policy_number text,
  insurance_file text,
  insurance_upload_pending boolean default false,
  add_insurance_to_rent boolean,

  -- Vehicle section
  has_vehicle boolean,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_color text,
  vehicle_plate text,
  vehicle_signature text,
  vehicle_signature_date date,

  -- Generated documents
  pet_addendum_file text,
  vehicle_addendum_file text,
  combined_pdf text,

  -- Audit
  ip_address text,
  user_agent text
);

-- Set up storage policies (bucket already exists)
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'submissions');

create policy "Allow authenticated reads"
on storage.objects for select
to authenticated
using (bucket_id = 'submissions');

-- IMPORTANT: Allow service_role to upload files (your backend)
create policy "Allow service role all access"
on storage.objects for all
to service_role
using (bucket_id = 'submissions');

-- Create RLS policies for submissions table
alter table submissions enable row level security;

create policy "Allow public inserts"
on submissions for insert
to anon
with check (true);

create policy "Allow authenticated reads"
on submissions for select
to authenticated
using (true);

-- Allow public updates for insurance (returning users can update)
create policy "Allow public updates for insurance"
on submissions for update
to anon
using (true)
with check (true);
