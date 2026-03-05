-- Create scan_batches table to track uploaded scan batches
create table scan_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),
  uploaded_by text,
  total_pages integer,
  status text default 'uploaded', -- 'uploaded', 'processing', 'ready_for_review', 'imported'
  notes text
);

-- Create scan_extractions table to store extracted data before final import
create table scan_extractions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references scan_batches(id) on delete cascade,
  page_number integer,
  scan_image_path text,
  scan_pdf_path text, -- Individual PDF of this scanned page
  extracted_data jsonb,
  confidence text, -- 'high', 'medium', 'low'
  reviewed boolean default false,
  reviewed_at timestamp,
  reviewed_by text,
  final_data jsonb, -- After human review/corrections
  imported boolean default false,
  submission_id uuid references submissions(id)
);

-- Enable RLS
alter table scan_batches enable row level security;
alter table scan_extractions enable row level security;

-- Allow authenticated users to read/write scan data
create policy "Allow authenticated access to scan_batches"
on scan_batches for all
to authenticated
using (true)
with check (true);

create policy "Allow authenticated access to scan_extractions"
on scan_extractions for all
to authenticated
using (true)
with check (true);

-- Create indexes for performance
create index idx_scan_extractions_batch_id on scan_extractions(batch_id);
create index idx_scan_extractions_reviewed on scan_extractions(reviewed);
create index idx_scan_extractions_imported on scan_extractions(imported);
create index idx_scan_batches_status on scan_batches(status);
