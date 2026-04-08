/**
 * Import accurate occupancy data using AF_UnitDirectory and AF_UnitVacancyDetail
 * 
 * Approach:
 * 1. Get all units from AF_UnitDirectory (total units)
 * 2. Get vacant units from AF_UnitVacancyDetail
 * 3. Calculate: Occupied = Total - Vacant
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

// Production DB (read-only) - has AF_UnitDirectory and AF_UnitVacancyDetail
const prodSupabase = createClient(
  'https://wkwmxxlfheywwbgdbzxe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrd214eGxmaGV5d3diZ2RienhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTcxOTIsImV4cCI6MjA3OTQ1NzE5Mn0.G4UyeP2BVuGG35oGDXMJcgbSCVVtBhSO6WddG-b6bm4'
);

// Test DB (write) - has tenant_lookup table
const testSupabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://lieeeqqvshobnqofcdac.supabase.co',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

// Mapping of property_name to building_address used in the app
const propertyNameToAddress: Record<string, string> = {
  "S0001 - 90 Park St": "90-100 Park St",
  "S0002 - 101 Maple": "97-103 Maple Ave",
  "S0003 - 222 Maple": "222-224 Maple Ave",
  "S0004 - 43 Frank": "43-45 Franklin Ave",
  "S0005 - 47 Frank": "47 Franklin Ave",
  "S0006 - 15 Whit": "15-17 Whitmore Street",
  "S0007 - 36 Whit": "36 Whitmore Street",
  "S0008 - 38 Whit": "38-40 Whitmore Street",
  "S0010 - 228 Maple": "228-230 Maple Ave",
  "S0011 - 110 Martin": "110 Martin St",
  "S0012 - 120 Martin": "120 Martin St",
  "S0013 - 152 Wooster": "152-154 Wooster St",
  "S0014 - 160 Wooster": "160 Wooster St",
  "S0015 - 165 Westland": "165 Westland St",
  "S0016 - 1721 Main": "1721-1739 Main St",
  "S0017 - 69 Chestnut": "69-73 Chestnut St",
  "S0018 - 90 Edwards": "91 Edwards St",
  "S0019 - 93 Maple": "93-95 Maple Ave",
  "S0020 - 31 Park": "31-33 Park St",
  "S0021 - 67 Park": "67-73 Park St",
  "S0022 - 83 Park": "83-91 Park St",
  "S0023 - 57 Park": "57-59 Park St",
  "S0024 - 10 Wolcott": "10 Wolcott St",
  "S0025 - 179 Affleck": "179 Affleck St",
  "S0026 - 144 Affleck": "144-146 Affleck St",
  "S0027 - 178 Affleck": "178 Affleck St",
  "S0028 - 182 Affleck": "182-184 Affleck St",
  "S0029 - 190 Affleck": "190-192 Affleck St",
  "S0030 - 195 Affleck": "195 Affleck St",
  "S0031 - 88-90 Ward": "88-90 Ward St",
  "S0032 - 865 Broad": "865 Broad St",
  "S0033 - 142 Seymour": "142 Seymour St",
  "S0034 - 158 Seymour": "158 Seymour St",
  "S0035 - 164 Seymour": "164 Seymour St",
  "S0036 - 167 Seymour": "167 Seymour St",
  "S0037 - 169 Seymour": "169 Seymour St",
  "S0038 - 170 Seymour": "170 Seymour St",
  "S0039 - 180 Seymour": "180 Seymour St",
  "S0040 - 213 Buckingh": "213-217 Buckingham St",
  "S0041 - 23-31 Squire": "23-31 Squire St",
};

async function importUnitOccupancy() {
  // Validate required environment variables before starting
  if (!cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || !cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('\n❌ Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
    console.error('   These should point to the test/app DB (not production).\n');
    process.exit(1);
  }

  console.log('🚀 Importing occupancy data from AF_UnitDirectory and AF_UnitVacancyDetail...\n');
  console.log('ℹ️  NOTE: AF_ table queries require a connection to the production AppFolio DB.');
  console.log('   The hardcoded property name map (lines 31-72) must be updated when new properties are added.\n');

  try {
    // Step 1: Fetch all units from AF_UnitDirectory (excluding S0049 properties)
    console.log('📦 Fetching all units from AF_UnitDirectory...');
    const { data: allUnits, error: unitsError } = await prodSupabase
      .from('AF_UnitDirectory')
      .select('property_name, unit_name, unit_id')
      .like('property_name', 'S00%')
      .not('property_name', 'like', 'S0049%'); // Exclude S0049 properties

    if (unitsError) {
      if (unitsError.message?.includes('does not exist') || unitsError.code === '42P01') {
        console.error('\n❌ AF_UnitDirectory table not found.');
        console.error('   Ensure prodSupabase credentials (lines 19-22) point to the production AppFolio DB.\n');
        process.exit(1);
      }
      throw unitsError;
    }
    console.log(`✅ Fetched ${allUnits.length} total units\n`);

    // Step 2: Fetch vacant units from AF_UnitVacancyDetail
    console.log('📦 Fetching vacant units from AF_UnitVacancyDetail...');
    const { data: vacantUnits, error: vacancyError } = await prodSupabase
      .from('AF_UnitVacancyDetail')
      .select('property_name, unit, unit_status')
      .like('unit_status', 'Vacant%');

    if (vacancyError) {
      if (vacancyError.message?.includes('does not exist') || vacancyError.code === '42P01') {
        console.error('\n❌ AF_UnitVacancyDetail table not found.');
        console.error('   Ensure prodSupabase credentials (lines 19-22) point to the production AppFolio DB.\n');
        process.exit(1);
      }
      throw vacancyError;
    }
    console.log(`✅ Fetched ${vacantUnits.length} vacant units\n`);

    // Step 3: Create vacancy lookup set
    console.log('🔄 Creating vacancy lookup...');
    const vacantSet = new Set(
      vacantUnits.map(v => `${v.property_name}|${v.unit}`)
    );
    console.log(`✅ Vacancy set created with ${vacantSet.size} vacant units\n`);

    // Step 4: Transform to tenant_lookup format
    console.log('🔄 Transforming data...');
    const lookupData = allUnits
      .filter(unit => propertyNameToAddress[unit.property_name]) // Only include mapped properties
      .map(unit => {
        const key = `${unit.property_name}|${unit.unit_name}`;
        const isOccupied = !vacantSet.has(key);

        return {
          name: isOccupied ? 'Occupied Unit' : null,
          first_name: null,
          last_name: null,
          phone: null,
          email: null,
          unit_number: unit.unit_name || '',
          building_address: propertyNameToAddress[unit.property_name],
          move_in: null,
          status: isOccupied ? 'Current' : 'Vacant',
          is_current: isOccupied,
        };
      });

    console.log(`✅ Transformed ${lookupData.length} unit records\n`);
    console.log(`   - Occupied: ${lookupData.filter(u => u.is_current).length}`);
    console.log(`   - Vacant: ${lookupData.filter(u => !u.is_current).length}\n`);

    // Clear existing tenant_lookup data
    console.log('🗑️  Clearing existing tenant_lookup data...');
    const { error: deleteError } = await testSupabase
      .from('tenant_lookup')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.warn('⚠️  Warning clearing old data:', deleteError.message);
    }

    // Insert new data in batches
    console.log('💾 Inserting new occupancy data...');
    const batchSize = 100;
    for (let i = 0; i < lookupData.length; i += batchSize) {
      const batch = lookupData.slice(i, i + batchSize);
      const { error: insertError } = await testSupabase
        .from('tenant_lookup')
        .insert(batch);

      if (insertError) throw insertError;
      console.log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(lookupData.length / batchSize)} inserted`);
    }

    console.log(`✅ Inserted ${lookupData.length} tenant records\n`);

    // Verify
    const { count } = await testSupabase
      .from('tenant_lookup')
      .select('*', { count: 'exact', head: true });

    console.log('✨ Import complete!');
    console.log(`📊 Total tenant records: ${count}`);

    // Show sample occupancy stats
    console.log('\n📈 Sample occupancy by building:');
    const buildingCounts: Record<string, number> = {};
    lookupData.forEach(t => {
      buildingCounts[t.building_address] = (buildingCounts[t.building_address] || 0) + 1;
    });
    
    Object.entries(buildingCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 10)
      .forEach(([building, count]) => {
        console.log(`  ${building}: ${count} occupied units`);
      });

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importUnitOccupancy();
