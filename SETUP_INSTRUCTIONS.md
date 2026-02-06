# Supabase Setup Instructions

## Step 1: Run Database Schema

Go to your Supabase project → **SQL Editor** and run this SQL:

```sql
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

-- Allow public updates for insurance (returning users)
CREATE POLICY "Allow public updates for insurance"
ON submissions FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
```

## Step 2: Set Up Storage Policies

Since you already created the `submissions` bucket, now add these policies:

Go to **Storage** → **submissions** bucket → **Policies** tab and run:

```sql
-- Set up storage policies
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'submissions');

create policy "Allow authenticated reads"
on storage.objects for select
to authenticated
using (bucket_id = 'submissions');

-- IMPORTANT: Also allow service_role (for your backend to upload)
create policy "Allow service role all access"
on storage.objects for all
to service_role
using (bucket_id = 'submissions');
```

**OR** you can make the bucket public for easier testing:
- Go to Storage → submissions bucket
- Click "Make Public" button
- This allows your backend (using service_role key) to upload without issues

## Step 3: Create Folder Structure

Supabase doesn't have "folders" - they're just prefixes in file paths. Your app will automatically create the folder structure when it uploads the first file to each location:

- `vaccinations/` - Created on first pet vaccination upload
- `pet_photos/` - Created on first pet photo upload
- `insurance/` - Created on first insurance doc upload
- `signatures/` - Created on first signature save
- `documents/` - Created on first generated Word doc

No action needed - they'll be created automatically!

## Step 4: Verify Setup

Run this query to check if table was created:

```sql
SELECT * FROM submissions LIMIT 1;
```

Should return empty result (no rows yet) but no error.

## Step 5: Test Your App

1. Start dev server:
```bash
npm run dev
```

2. Go to `http://localhost:3000` (or 3001 if 3000 is taken)

3. Fill out and submit the form

4. Check Supabase:
   - Table Editor → submissions → Should see your data
   - Storage → submissions → Should see uploaded files

## Troubleshooting

### "relation submissions does not exist"
→ Run the SQL schema in Step 1

### "new row violates row-level security policy"
→ Make sure RLS policies are created (Step 1)

### "Failed to upload file to storage"
→ Check storage policies (Step 2) or make bucket public

### "permission denied for table submissions"
→ Your service_role key might be wrong in .env.local
