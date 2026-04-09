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
import { appfolioNameToAddress, appfolioNameToAssetId } from '../lib/buildings';

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

// Building identity maps imported from lib/buildings.ts (single source of truth)
const propertyNameToAddress = appfolioNameToAddress;

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
          asset_id: appfolioNameToAssetId[unit.property_name] || null,
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
