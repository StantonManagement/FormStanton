/**
 * Simple script to import tenant lookup data from production to test DB
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

const prodSupabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_PROD_SUPABASE_URL) || '',
  cleanEnv(process.env.NEXT_PUBLIC_PROD_SUPABASE_ANON_KEY) || ''
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

    // Transform and insert into test DB
    console.log('💾 Inserting into test DB...');
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

    // Insert in batches of 100
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
