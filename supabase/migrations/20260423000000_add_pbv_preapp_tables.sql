-- PBV Pre-Application tables: pbv_income_thresholds, unit_bedroom_map, pbv_preapplications
-- One migration per PRD rule 8

-- 1. Income threshold lookup table
CREATE TABLE pbv_income_thresholds (
  id uuid primary key default gen_random_uuid(),
  household_size integer not null,
  income_limit integer not null,
  effective_date date not null,
  created_at timestamp default now()
);

ALTER TABLE pbv_income_thresholds ENABLE ROW LEVEL SECURITY;

-- 2. Unit bedroom count mapping
CREATE TABLE unit_bedroom_map (
  id uuid primary key default gen_random_uuid(),
  building_address text not null,
  unit_number text not null,
  bedroom_count integer not null,
  UNIQUE(building_address, unit_number)
);

ALTER TABLE unit_bedroom_map ENABLE ROW LEVEL SECURITY;

-- 3. PBV pre-applications
CREATE TABLE pbv_preapplications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  created_by text,
  project_unit_id uuid references project_units(id),
  task_completion_id uuid references task_completions(id),
  hoh_name text not null,
  hoh_dob date not null,
  building_address text not null,
  unit_number text not null,
  household_members jsonb not null,
  household_size integer not null,
  total_household_income integer not null,
  hoh_is_citizen boolean not null,
  other_adult_citizen boolean,
  bedroom_count integer,
  income_limit integer,
  qualification_result text not null CHECK (qualification_result IN ('likely_qualifies', 'over_income', 'citizenship_issue', 'over_income_and_citizenship')),
  signature_data text not null,
  signature_date date not null,
  stanton_review_status text not null default 'pending' CHECK (stanton_review_status IN ('pending', 'approved', 'denied', 'needs_info')),
  stanton_reviewer text,
  stanton_review_date timestamp,
  stanton_review_notes text,
  language text not null default 'en'
);

ALTER TABLE pbv_preapplications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_pbv_preapplications_updated_at
  BEFORE UPDATE ON pbv_preapplications
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Seed income thresholds (placeholder values — $30k increments starting at $40k)
-- Alex/Dan to confirm final numbers from HACH before activation
INSERT INTO pbv_income_thresholds (household_size, income_limit, effective_date) VALUES
  (1, 40000, '2026-01-01'),
  (2, 70000, '2026-01-01'),
  (3, 100000, '2026-01-01'),
  (4, 130000, '2026-01-01'),
  (5, 160000, '2026-01-01'),
  (6, 190000, '2026-01-01'),
  (7, 220000, '2026-01-01'),
  (8, 250000, '2026-01-01');

-- Seed unit bedroom map (bedroom_count = 2 placeholder for all known units)
-- Will be updated from AppFolio data before activation
INSERT INTO unit_bedroom_map (building_address, unit_number, bedroom_count) VALUES
  -- 90-100 Park St
  ('90-100 Park St', '1', 2), ('90-100 Park St', '2', 2), ('90-100 Park St', '3', 2),
  ('90-100 Park St', '4', 2), ('90-100 Park St', '5 - A', 2), ('90-100 Park St', '5 - B', 2),
  ('90-100 Park St', '5 - C', 2), ('90-100 Park St', '5 - D', 2), ('90-100 Park St', '5 - E', 2),
  ('90-100 Park St', '7 - A', 2), ('90-100 Park St', '7 - B', 2), ('90-100 Park St', '9', 2),
  ('90-100 Park St', '10', 2), ('90-100 Park St', 'Retail 1', 2), ('90-100 Park St', 'Retail 2', 2),
  -- 97-103 Maple Ave
  ('97-103 Maple Ave', 'A2', 2), ('97-103 Maple Ave', 'B1 - A', 2), ('97-103 Maple Ave', 'B1 - B', 2),
  ('97-103 Maple Ave', 'B1 - C', 2), ('97-103 Maple Ave', 'B2', 2), ('97-103 Maple Ave', 'B3', 2),
  ('97-103 Maple Ave', 'B4 - A', 2), ('97-103 Maple Ave', 'B4 - C', 2), ('97-103 Maple Ave', 'C1 - -', 2),
  ('97-103 Maple Ave', 'C2', 2), ('97-103 Maple Ave', 'C3', 2), ('97-103 Maple Ave', 'C4', 2),
  ('97-103 Maple Ave', 'C4 - A', 2), ('97-103 Maple Ave', 'C4 - B', 2), ('97-103 Maple Ave', 'D1', 2),
  ('97-103 Maple Ave', 'D2', 2), ('97-103 Maple Ave', 'D3', 2), ('97-103 Maple Ave', 'D4 - A', 2),
  ('97-103 Maple Ave', 'D4 - B', 2), ('97-103 Maple Ave', 'Retail 1', 2), ('97-103 Maple Ave', 'Retail 2', 2),
  -- 222-224 Maple Ave
  ('222-224 Maple Ave', '1N', 2), ('222-224 Maple Ave', '1S', 2), ('222-224 Maple Ave', '2N', 2),
  ('222-224 Maple Ave', '2S', 2), ('222-224 Maple Ave', '3N', 2), ('222-224 Maple Ave', '3S', 2),
  -- 43-45 Franklin Ave
  ('43-45 Franklin Ave', '1N', 2), ('43-45 Franklin Ave', '1S', 2), ('43-45 Franklin Ave', '2N', 2),
  ('43-45 Franklin Ave', '2S', 2), ('43-45 Franklin Ave', '3N', 2), ('43-45 Franklin Ave', '3S', 2),
  -- 47 Franklin Ave
  ('47 Franklin Ave', '1', 2), ('47 Franklin Ave', '2', 2), ('47 Franklin Ave', '3', 2), ('47 Franklin Ave', '4', 2),
  -- 15-17 Whitmore Street
  ('15-17 Whitmore Street', '1E', 2), ('15-17 Whitmore Street', '1W - A', 2), ('15-17 Whitmore Street', '1W - B & C', 2),
  ('15-17 Whitmore Street', '2E', 2), ('15-17 Whitmore Street', '2W', 2), ('15-17 Whitmore Street', '3E', 2),
  ('15-17 Whitmore Street', '3W', 2),
  -- 36 Whitmore Street
  ('36 Whitmore Street', '1E', 2), ('36 Whitmore Street', '1W', 2), ('36 Whitmore Street', '2E', 2),
  ('36 Whitmore Street', '2W', 2), ('36 Whitmore Street', '3E', 2), ('36 Whitmore Street', '3W', 2),
  -- 38-40 Whitmore Street
  ('38-40 Whitmore Street', '1E', 2), ('38-40 Whitmore Street', '1W', 2), ('38-40 Whitmore Street', '2E', 2),
  ('38-40 Whitmore Street', '2W', 2), ('38-40 Whitmore Street', '3E', 2), ('38-40 Whitmore Street', '3W', 2),
  -- 228-230 Maple Ave
  ('228-230 Maple Ave', '1N', 2), ('228-230 Maple Ave', '2N', 2), ('228-230 Maple Ave', '2S', 2),
  ('228-230 Maple Ave', '3N', 2), ('228-230 Maple Ave', '3S', 2),
  -- 110 Martin St
  ('110 Martin St', '1', 2), ('110 Martin St', '2', 2), ('110 Martin St', '3', 2), ('110 Martin St', '4', 2),
  ('110 Martin St', '5', 2), ('110 Martin St', '6', 2), ('110 Martin St', '7', 2),
  -- 120 Martin St
  ('120 Martin St', '1st', 2), ('120 Martin St', '2nd', 2),
  -- 152-154 Wooster St
  ('152-154 Wooster St', '1A', 2), ('152-154 Wooster St', '1B', 2), ('152-154 Wooster St', '2A', 2),
  ('152-154 Wooster St', '2B', 2), ('152-154 Wooster St', '3A', 2), ('152-154 Wooster St', '3B', 2),
  -- 160 Wooster St
  ('160 Wooster St', '1', 2), ('160 Wooster St', '2', 2), ('160 Wooster St', '3', 2),
  -- 165 Westland St
  ('165 Westland St', '1A', 2), ('165 Westland St', '1C', 2), ('165 Westland St', '1D', 2),
  ('165 Westland St', '1E', 2), ('165 Westland St', '2A', 2), ('165 Westland St', '2B', 2),
  ('165 Westland St', '2C', 2), ('165 Westland St', '2D', 2), ('165 Westland St', '2E', 2),
  ('165 Westland St', '3A', 2), ('165 Westland St', '3B', 2), ('165 Westland St', '3C', 2),
  ('165 Westland St', '3D', 2), ('165 Westland St', '3E', 2),
  -- 1721-1739 Main St
  ('1721-1739 Main St', '1721', 2), ('1721-1739 Main St', '1723', 2), ('1721-1739 Main St', '1725', 2),
  ('1721-1739 Main St', '1727', 2), ('1721-1739 Main St', '1729', 2), ('1721-1739 Main St', '1731', 2),
  ('1721-1739 Main St', '1733', 2), ('1721-1739 Main St', '1735', 2),
  -- 69-73 Chestnut St
  ('69-73 Chestnut St', '71A', 2), ('69-73 Chestnut St', '71B', 2), ('69-73 Chestnut St', '71C', 2),
  ('69-73 Chestnut St', '71D', 2), ('69-73 Chestnut St', '71E', 2), ('69-73 Chestnut St', '73A', 2),
  ('69-73 Chestnut St', '73B', 2), ('69-73 Chestnut St', '73C', 2), ('69-73 Chestnut St', '73D', 2),
  ('69-73 Chestnut St', '73E', 2),
  -- 91 Edwards St
  ('91 Edwards St', '90A', 2), ('91 Edwards St', '90B', 2), ('91 Edwards St', '90C', 2),
  -- 93-95 Maple Ave
  ('93-95 Maple Ave', '1', 2), ('93-95 Maple Ave', '2', 2), ('93-95 Maple Ave', '3', 2),
  -- 31-33 Park St
  ('31-33 Park St', 'Retail 1', 2),
  -- 67-73 Park St
  ('67-73 Park St', '201', 2), ('67-73 Park St', '202', 2), ('67-73 Park St', '302', 2),
  ('67-73 Park St', 'COM 67 Park', 2), ('67-73 Park St', 'COM 75 Park', 2),
  -- 83-91 Park St
  ('83-91 Park St', '201', 2), ('83-91 Park St', '202', 2), ('83-91 Park St', '203', 2),
  ('83-91 Park St', '301', 2), ('83-91 Park St', '302', 2), ('83-91 Park St', '303', 2),
  ('83-91 Park St', 'COM 83 Park', 2), ('83-91 Park St', 'COM 91 Park', 2),
  -- 57-59 Park St
  ('57-59 Park St', '2W', 2), ('57-59 Park St', 'COM 57 Park', 2),
  -- 179 Affleck St
  ('179 Affleck St', '1N', 2), ('179 Affleck St', '1S', 2), ('179 Affleck St', '2N', 2),
  ('179 Affleck St', '2S', 2), ('179 Affleck St', '3N', 2), ('179 Affleck St', '3S', 2),
  ('179 Affleck St', '4N', 2), ('179 Affleck St', '4S', 2),
  -- 144-146 Affleck St
  ('144-146 Affleck St', '1S', 2), ('144-146 Affleck St', '2N', 2), ('144-146 Affleck St', '2S', 2),
  ('144-146 Affleck St', '3N', 2), ('144-146 Affleck St', '3S', 2),
  -- 178 Affleck St
  ('178 Affleck St', '1', 2), ('178 Affleck St', '2', 2), ('178 Affleck St', '3', 2),
  ('178 Affleck St', '4', 2), ('178 Affleck St', '4S', 2),
  -- 182-184 Affleck St
  ('182-184 Affleck St', '1', 2), ('182-184 Affleck St', '2', 2),
  -- 190-192 Affleck St
  ('190-192 Affleck St', '1N', 2), ('190-192 Affleck St', '1S', 2), ('190-192 Affleck St', '2N', 2),
  ('190-192 Affleck St', '2S', 2), ('190-192 Affleck St', '3N', 2), ('190-192 Affleck St', '3S', 2),
  -- 195 Affleck St
  ('195 Affleck St', '1B', 2), ('195 Affleck St', '2A', 2), ('195 Affleck St', '2B', 2),
  ('195 Affleck St', '3A', 2), ('195 Affleck St', '3B', 2), ('195 Affleck St', '4A', 2),
  ('195 Affleck St', '4B', 2),
  -- 88-90 Ward St
  ('88-90 Ward St', '1A', 2), ('88-90 Ward St', '1B', 2), ('88-90 Ward St', '2A', 2),
  ('88-90 Ward St', '2B', 2), ('88-90 Ward St', '3A', 2), ('88-90 Ward St', '3B', 2),
  -- 865 Broad St
  ('865 Broad St', 'A1', 2), ('865 Broad St', 'A2', 2), ('865 Broad St', 'A3', 2),
  ('865 Broad St', 'B1', 2), ('865 Broad St', 'B2', 2), ('865 Broad St', 'B3', 2), ('865 Broad St', 'B4', 2),
  ('865 Broad St', 'C1', 2), ('865 Broad St', 'C2', 2), ('865 Broad St', 'C3', 2), ('865 Broad St', 'C4', 2),
  ('865 Broad St', 'D1', 2), ('865 Broad St', 'D2', 2), ('865 Broad St', 'D3', 2), ('865 Broad St', 'D4', 2),
  -- 142 Seymour St
  ('142 Seymour St', '1', 2), ('142 Seymour St', '2', 2),
  -- 158 Seymour St
  ('158 Seymour St', '1E', 2), ('158 Seymour St', '1W', 2), ('158 Seymour St', '2E', 2),
  ('158 Seymour St', '2W', 2), ('158 Seymour St', '3E', 2), ('158 Seymour St', '3W', 2),
  ('158 Seymour St', '4E', 2), ('158 Seymour St', '4W', 2),
  -- 164 Seymour St
  ('164 Seymour St', '1', 2), ('164 Seymour St', '2', 2), ('164 Seymour St', '3', 2),
  -- 167 Seymour St
  ('167 Seymour St', '1NE', 2), ('167 Seymour St', '1NW', 2), ('167 Seymour St', '1SE', 2), ('167 Seymour St', '1SW', 2),
  ('167 Seymour St', '2NE', 2), ('167 Seymour St', '2NW', 2), ('167 Seymour St', '2SE', 2), ('167 Seymour St', '2SW', 2),
  ('167 Seymour St', '3NE', 2), ('167 Seymour St', '3NW', 2), ('167 Seymour St', '3SE', 2), ('167 Seymour St', '3SW', 2),
  -- 169 Seymour St
  ('169 Seymour St', '1N', 2), ('169 Seymour St', '1S', 2), ('169 Seymour St', '2N', 2),
  ('169 Seymour St', '2S', 2), ('169 Seymour St', '2W', 2), ('169 Seymour St', '3N', 2),
  ('169 Seymour St', '3S', 2), ('169 Seymour St', '3W', 2), ('169 Seymour St', '4N', 2),
  ('169 Seymour St', '4S', 2), ('169 Seymour St', '4W', 2),
  -- 170 Seymour St
  ('170 Seymour St', '1N', 2), ('170 Seymour St', '1S', 2), ('170 Seymour St', '2S', 2),
  ('170 Seymour St', '3N', 2), ('170 Seymour St', '3S', 2),
  -- 180 Seymour St
  ('180 Seymour St', '1', 2), ('180 Seymour St', '2', 2),
  -- 213-217 Buckingham St
  ('213-217 Buckingham St', '202', 2), ('213-217 Buckingham St', '203', 2), ('213-217 Buckingham St', '205', 2),
  ('213-217 Buckingham St', '206', 2), ('213-217 Buckingham St', '207', 2), ('213-217 Buckingham St', '301', 2),
  ('213-217 Buckingham St', '302', 2), ('213-217 Buckingham St', '304', 2), ('213-217 Buckingham St', '305', 2),
  ('213-217 Buckingham St', '306', 2), ('213-217 Buckingham St', '307', 2), ('213-217 Buckingham St', '406', 2),
  ('213-217 Buckingham St', '407', 2),
  -- 23-31 Squire St
  ('23-31 Squire St', '1A', 2), ('23-31 Squire St', '1B', 2), ('23-31 Squire St', '1C', 2), ('23-31 Squire St', '1D', 2),
  ('23-31 Squire St', '2A', 2), ('23-31 Squire St', '2B', 2), ('23-31 Squire St', '2C', 2), ('23-31 Squire St', '2D', 2),
  ('23-31 Squire St', '2E', 2), ('23-31 Squire St', '2F', 2)
ON CONFLICT (building_address, unit_number) DO NOTHING;
