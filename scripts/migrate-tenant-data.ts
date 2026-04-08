/**
 * Migration script to copy tenant data from production DB to test DB
 * Run with: npx tsx scripts/migrate-tenant-data.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from both files
config({ path: '.env' });
config({ path: '.env.local', override: true });

// Remove quotes from env vars if present
const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

// Production DB (read-only)
const prodSupabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_PROD_SUPABASE_URL) || '',
  cleanEnv(process.env.NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY) || ''
);

// Test DB (write)
const testSupabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

async function migrateData() {
  // Validate required environment variables before starting
  const appUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const appKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const prodUrl = cleanEnv(process.env.NEXT_PUBLIC_PROD_SUPABASE_URL);
  const prodKey = cleanEnv(process.env.NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY);

  if (!appUrl || !appKey) {
    console.error('\n❌ Missing app DB env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local\n');
    process.exit(1);
  }
  if (!prodUrl || !prodKey) {
    console.error('\n❌ Missing production DB env vars: NEXT_PUBLIC_PROD_SUPABASE_URL and NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY must be set in .env.local\n');
    process.exit(1);
  }

  console.log('🚀 Starting tenant data migration...\n');

  try {
    // Step 1: Fetch all properties from production
    console.log('📦 Fetching properties from production DB...');
    const { data: prodProperties, error: propError } = await prodSupabase
      .from('acct_property_master')
      .select('id, asset_id, llc_name, portfolio, address, units')
      .order('address');

    if (propError) {
      if (propError.message?.includes('does not exist') || propError.code === '42P01') {
        console.error('\n❌ acct_property_master table not found.');
        console.error('   Ensure NEXT_PUBLIC_PROD_SUPABASE_URL points to the production DB.\n');
        process.exit(1);
      }
      throw propError;
    }
    console.log(`✅ Fetched ${prodProperties.length} properties\n`);

    // Step 2: Insert properties into test DB
    console.log('💾 Inserting properties into test DB...');
    const propertyInserts = prodProperties.map(p => ({
      id: p.id,
      asset_id: p.asset_id,
      llc_name: p.llc_name,
      portfolio: p.portfolio,
      address: p.address,
      units_count: p.units
    }));

    const { error: insertPropError } = await testSupabase
      .from('properties')
      .insert(propertyInserts);

    if (insertPropError) throw insertPropError;
    console.log(`✅ Inserted ${propertyInserts.length} properties\n`);

    // Step 3: Fetch all units from production
    console.log('📦 Fetching units from production DB...');
    const { data: prodUnits, error: unitsError } = await prodSupabase
      .from('units')
      .select('id, property_id, unit_number, tenant_name, status, monthly_rent');

    if (unitsError) throw unitsError;
    console.log(`✅ Fetched ${prodUnits.length} units\n`);

    // Step 4: Map units to test DB properties and insert
    console.log('💾 Inserting units into test DB...');
    
    // Create property mapping (prod property_id -> test property by address)
    const { data: testProperties } = await testSupabase
      .from('properties')
      .select('id, address');

    const addressToTestId = new Map(testProperties?.map(p => [p.address, p.id]) || []);

    // Get production property addresses
    const { data: prodProps } = await prodSupabase
      .from('acct_property_master')
      .select('id, address');

    const prodIdToAddress = new Map(prodProps?.map(p => [p.id, p.address]) || []);

    const unitInserts = prodUnits
      .map(u => {
        const address = prodIdToAddress.get(u.property_id);
        const testPropertyId = address ? addressToTestId.get(address) : null;
        
        if (!testPropertyId) {
          console.warn(`⚠️  Could not map unit ${u.unit_number} - property not found`);
          return null;
        }

        return {
          id: u.id,
          property_id: testPropertyId,
          unit_number: u.unit_number,
          tenant_name: u.tenant_name,
          status: u.status,
          monthly_rent: u.monthly_rent
        };
      })
      .filter(Boolean);

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < unitInserts.length; i += batchSize) {
      const batch = unitInserts.slice(i, i + batchSize);
      const { error: insertUnitsError } = await testSupabase
        .from('units')
        .insert(batch);

      if (insertUnitsError) throw insertUnitsError;
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(unitInserts.length / batchSize)}`);
    }
    console.log(`✅ Inserted ${unitInserts.length} units\n`);

    // Step 5: Fetch all tenants from production
    console.log('📦 Fetching tenants from production DB...');
    const { data: prodTenants, error: tenantsError } = await prodSupabase
      .from('tenants')
      .select('id, af_unit_id, name, first_name, last_name, phone_numbers, email, move_in, move_out, status, is_current');

    if (tenantsError) throw tenantsError;
    console.log(`✅ Fetched ${prodTenants.length} tenants\n`);

    // Step 6: Map tenants to test DB units and insert
    console.log('💾 Inserting tenants into test DB...');

    // Get unit mapping (prod af_unit_id -> test unit id)
    const { data: prodUnitsMap } = await prodSupabase
      .from('units')
      .select('id, af_unit_id');

    const afUnitIdToProdId = new Map(prodUnitsMap?.map(u => [u.af_unit_id, u.id]) || []);

    const { data: testUnits } = await testSupabase
      .from('units')
      .select('id');

    const prodUnitIdToTestId = new Map(testUnits?.map(u => [u.id, u.id]) || []);

    const tenantInserts = prodTenants
      .map(t => {
        const prodUnitId = afUnitIdToProdId.get(t.af_unit_id);
        const testUnitId = prodUnitId ? prodUnitIdToTestId.get(prodUnitId) : null;

        if (!testUnitId) {
          return null;
        }

        return {
          id: t.id,
          unit_id: testUnitId,
          name: t.name,
          first_name: t.first_name,
          last_name: t.last_name,
          phone_numbers: t.phone_numbers,
          email: t.email,
          move_in: t.move_in,
          move_out: t.move_out,
          status: t.status,
          is_current: t.is_current
        };
      })
      .filter(Boolean);

    // Insert in batches of 100
    for (let i = 0; i < tenantInserts.length; i += batchSize) {
      const batch = tenantInserts.slice(i, i + batchSize);
      const { error: insertTenantsError } = await testSupabase
        .from('tenants')
        .insert(batch);

      if (insertTenantsError) throw insertTenantsError;
      console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tenantInserts.length / batchSize)}`);
    }
    console.log(`✅ Inserted ${tenantInserts.length} tenants\n`);

    // Step 7: Verify migration
    console.log('🔍 Verifying migration...');
    const { count: propCount } = await testSupabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    const { count: unitCount } = await testSupabase
      .from('units')
      .select('*', { count: 'exact', head: true });

    const { count: tenantCount } = await testSupabase
      .from('tenants')
      .select('*', { count: 'exact', head: true });

    console.log('\n✨ Migration complete!');
    console.log(`📊 Final counts:`);
    console.log(`   Properties: ${propCount}`);
    console.log(`   Units: ${unitCount}`);
    console.log(`   Tenants: ${tenantCount}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
