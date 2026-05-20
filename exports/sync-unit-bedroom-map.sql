-- Sync public.unit_bedroom_map with AppFolio unit_directory-20260518.csv
-- 1) Remove known bad row (178 Affleck "4S" never existed)
-- 2) Insert missing units (canonical properties.address)
-- 3) Update bedroom_count on existing rows to match AppFolio
BEGIN;

DELETE FROM public.unit_bedroom_map WHERE building_address = '178 Affleck St' AND unit_number = '4S';

INSERT INTO public.unit_bedroom_map (building_address, unit_number, bedroom_count) VALUES
  ('90 Park Street', '6', 4),
  ('90 Park Street', '8', 2),
  ('97-103 Maple Ave', 'B4 - B', 0),
  ('97-103 Maple Ave', 'D4 - C', 0),
  ('97-103 Maple Ave', 'Retail 3', 0),
  ('228 Maple Ave', '1S', 3),
  ('165 Westland St', '1B', 0),
  ('93-95 Maple Ave', 'Retail', 0),
  ('31-33 Park St', '1N', 1),
  ('31-33 Park St', '1S', 2),
  ('31-33 Park St', '2N', 2),
  ('31-33 Park St', '2S', 2),
  ('31-33 Park St', '3N', 2),
  ('31-33 Park St', '3S', 2),
  ('67-73 Park St', '301', 2),
  ('83-91 Park St', 'COM 85 Park', 0),
  ('83-91 Park St', 'COM 89 Park', 0),
  ('57 Park St', '2E', 3),
  ('10 Wolcott St', '1N', 2),
  ('10 Wolcott St', '1S', 4),
  ('10 Wolcott St', '2N', 2),
  ('10 Wolcott St', '2S', 4),
  ('10 Wolcott St', '3E', 4),
  ('10 Wolcott St', '3N', 2),
  ('10 Wolcott St', '3S', 4),
  ('144-146 Affleck St', '1N', 2),
  ('182 Affleck St', 'COM 184 Affleck', 0),
  ('195 Affleck St', '1A', 3),
  ('170 Seymour St', '2N', 3),
  ('213-217 Buckingham St', '101', 0),
  ('213-217 Buckingham St', '102', 0),
  ('213-217 Buckingham St', '103', 0),
  ('213-217 Buckingham St', '201', 0),
  ('213-217 Buckingham St', '204', 0),
  ('213-217 Buckingham St', '303', 0),
  ('213-217 Buckingham St', '401', 0),
  ('213-217 Buckingham St', '402', 1),
  ('213-217 Buckingham St', '403', 0),
  ('213-217 Buckingham St', '404', 0),
  ('213-217 Buckingham St', '405', 1);

UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '110 Martin St' AND unit_number = '4'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '110 Martin St' AND unit_number = '5'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '110 Martin St' AND unit_number = '6'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '110 Martin St' AND unit_number = '7'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '120 Martin St' AND unit_number = '2nd'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '142 Seymour St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '142 Seymour St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '15-17 Whitmore Street' AND unit_number = '1W - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '15-17 Whitmore Street' AND unit_number = '1W - B & C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '158 Seymour St' AND unit_number = '1W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '158 Seymour St' AND unit_number = '2E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '158 Seymour St' AND unit_number = '2W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '158 Seymour St' AND unit_number = '3E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '158 Seymour St' AND unit_number = '3W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '158 Seymour St' AND unit_number = '4E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '158 Seymour St' AND unit_number = '4W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '160 Wooster St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '160 Wooster St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '160 Wooster St' AND unit_number = '3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '164 Seymour St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '164 Seymour St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '164 Seymour St' AND unit_number = '3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '165 Westland St' AND unit_number = '1D'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '165 Westland St' AND unit_number = '2B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '165 Westland St' AND unit_number = '2C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '165 Westland St' AND unit_number = '3B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '165 Westland St' AND unit_number = '3C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '167 Seymour St' AND unit_number = '1NE'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '167 Seymour St' AND unit_number = '1NW'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '167 Seymour St' AND unit_number = '1SE'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '167 Seymour St' AND unit_number = '1SW'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '167 Seymour St' AND unit_number = '2NE'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '167 Seymour St' AND unit_number = '2NW'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '167 Seymour St' AND unit_number = '2SE'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '167 Seymour St' AND unit_number = '2SW'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '167 Seymour St' AND unit_number = '3NE'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '167 Seymour St' AND unit_number = '3NW'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '167 Seymour St' AND unit_number = '3SE'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '167 Seymour St' AND unit_number = '3SW'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '169 Seymour St' AND unit_number = '1N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '169 Seymour St' AND unit_number = '1S'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '169 Seymour St' AND unit_number = '2W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '169 Seymour St' AND unit_number = '3W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '169 Seymour St' AND unit_number = '4W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '170 Seymour St' AND unit_number = '3N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '1721-1739 Main St' AND unit_number = '1723'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '1721-1739 Main St' AND unit_number = '1725'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '1721-1739 Main St' AND unit_number = '1731'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '1721-1739 Main St' AND unit_number = '1733'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '178 Affleck St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '178 Affleck St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '178 Affleck St' AND unit_number = '3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '178 Affleck St' AND unit_number = '4'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '180 Seymour St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '180 Seymour St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '182-184 Affleck St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '182-184 Affleck St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '195 Affleck St' AND unit_number = '2A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '195 Affleck St' AND unit_number = '2B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '195 Affleck St' AND unit_number = '3A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '195 Affleck St' AND unit_number = '3B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '195 Affleck St' AND unit_number = '4A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '195 Affleck St' AND unit_number = '4B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '202'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '203'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '213-217 Buckingham St' AND unit_number = '205'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '206'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '213-217 Buckingham St' AND unit_number = '207'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '301'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '213-217 Buckingham St' AND unit_number = '302'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '304'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '213-217 Buckingham St' AND unit_number = '305'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '306'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '213-217 Buckingham St' AND unit_number = '307'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '213-217 Buckingham St' AND unit_number = '406'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '213-217 Buckingham St' AND unit_number = '407'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '228-230 Maple Ave' AND unit_number = '1N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '228-230 Maple Ave' AND unit_number = '2N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '228-230 Maple Ave' AND unit_number = '2S'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '228-230 Maple Ave' AND unit_number = '3N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '228-230 Maple Ave' AND unit_number = '3S'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '23-31 Squire St' AND unit_number = '1A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '23-31 Squire St' AND unit_number = '1B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '23-31 Squire St' AND unit_number = '2A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '23-31 Squire St' AND unit_number = '2B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '23-31 Squire St' AND unit_number = '2C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '23-31 Squire St' AND unit_number = '2D'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '23-31 Squire St' AND unit_number = '2E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '23-31 Squire St' AND unit_number = '2F'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '31-33 Park St' AND unit_number = 'Retail 1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '36 Whitmore Street' AND unit_number = '1E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '36 Whitmore Street' AND unit_number = '1W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '36 Whitmore Street' AND unit_number = '2E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '36 Whitmore Street' AND unit_number = '2W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '36 Whitmore Street' AND unit_number = '3E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '36 Whitmore Street' AND unit_number = '3W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '38-40 Whitmore Street' AND unit_number = '1E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '38-40 Whitmore Street' AND unit_number = '1W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '38-40 Whitmore Street' AND unit_number = '2E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '38-40 Whitmore Street' AND unit_number = '2W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '38-40 Whitmore Street' AND unit_number = '3E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '38-40 Whitmore Street' AND unit_number = '3W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '43-45 Franklin Ave' AND unit_number = '1S'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '43-45 Franklin Ave' AND unit_number = '2N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '43-45 Franklin Ave' AND unit_number = '2S'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '43-45 Franklin Ave' AND unit_number = '3N'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '43-45 Franklin Ave' AND unit_number = '3S'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '57-59 Park St' AND unit_number = '2W'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '57-59 Park St' AND unit_number = 'COM 57 Park'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '67-73 Park St' AND unit_number = 'COM 67 Park'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '67-73 Park St' AND unit_number = 'COM 75 Park'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '69-73 Chestnut St' AND unit_number = '71C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '69-73 Chestnut St' AND unit_number = '71D'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '69-73 Chestnut St' AND unit_number = '71E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '69-73 Chestnut St' AND unit_number = '73A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '69-73 Chestnut St' AND unit_number = '73B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '69-73 Chestnut St' AND unit_number = '73E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '83-91 Park St' AND unit_number = '203'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '83-91 Park St' AND unit_number = '303'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '83-91 Park St' AND unit_number = 'COM 83 Park'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '83-91 Park St' AND unit_number = 'COM 91 Park'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'A1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'A2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'A3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'B1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'B2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'B3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'B4'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'C1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'C2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'C3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'C4'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'D1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'D2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'D3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '865 Broad St' AND unit_number = 'D4'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '88-90 Ward St' AND unit_number = '1A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '88-90 Ward St' AND unit_number = '1B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '88-90 Ward St' AND unit_number = '2A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '88-90 Ward St' AND unit_number = '2B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '88-90 Ward St' AND unit_number = '3A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '88-90 Ward St' AND unit_number = '3B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '90-100 Park St' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '90-100 Park St' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '90-100 Park St' AND unit_number = '3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 4 WHERE building_address = '90-100 Park St' AND unit_number = '4'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '5 - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '5 - B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '5 - C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '5 - D'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '5 - E'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '7 - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = '7 - B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = 'Retail 1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '90-100 Park St' AND unit_number = 'Retail 2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 3 WHERE building_address = '91 Edwards St' AND unit_number = '90C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 5 WHERE building_address = '93-95 Maple Ave' AND unit_number = '1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 5 WHERE building_address = '93-95 Maple Ave' AND unit_number = '2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 5 WHERE building_address = '93-95 Maple Ave' AND unit_number = '3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'A2'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'B1 - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'B1 - B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'B1 - C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'B3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'B4 - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'B4 - C'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'C3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'C4 - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'C4 - B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 1 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'D3'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'D4 - A'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'D4 - B'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'Retail 1'; -- was 2
UPDATE public.unit_bedroom_map SET bedroom_count = 0 WHERE building_address = '97-103 Maple Ave' AND unit_number = 'Retail 2'; -- was 2

COMMIT;

