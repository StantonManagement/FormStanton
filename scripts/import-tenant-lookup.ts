/**
 * Simple script to import tenant lookup data from production to test DB
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

// Production DB - for fetching current tenant data
const prodSupabase = createClient(
  'https://wkwmxxlfheywwbgdbzxe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrd214eGxmaGV5d3diZ2RienhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTcxOTIsImV4cCI6MjA3OTQ1NzE5Mn0.G4UyeP2BVuGG35oGDXMJcgbSCVVtBhSO6WddG-b6bm4'
);

const testSupabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

async function importTenantLookup() {
  console.log('🚀 Importing tenant lookup data...\n');

  try {
    // Fetch all current tenants from production
    console.log('📦 Fetching tenants from production DB...');
    const { data: tenants, error } = await prodSupabase
      .from('tenants')
      .select('name, first_name, last_name, phone_numbers, email, unit, property_address, move_in, status, is_current')
      .eq('is_current', true);

    if (error) throw error;
    console.log(`✅ Fetched ${tenants.length} current tenants\n`);

    // Transform data
    console.log('� Transforming tenant data...');
    const lookupData = tenants.map(t => ({
      name: t.name,
      first_name: t.first_name,
      last_name: t.last_name,
      phone: t.phone_numbers,
      email: t.email,
      unit_number: t.unit,
      building_address: t.property_address,
      move_in: t.move_in,
      status: t.status,
      is_current: t.is_current
    }));

    console.log(`✅ Transformed ${lookupData.length} tenant records\n`);

    // Clear existing tenant_lookup data
    console.log('🗑️  Clearing existing tenant_lookup data...');
    const { error: deleteError } = await testSupabase
      .from('tenant_lookup')
      .delete()
      .neq('id', 0); // Delete all records

    if (deleteError) {
      console.warn('⚠️  Warning clearing old data:', deleteError.message);
    } else {
      console.log('✅ Cleared existing data\n');
    }

    // Insert in batches of 100
    console.log('💾 Inserting new tenant data...');
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

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importTenantLookup();
