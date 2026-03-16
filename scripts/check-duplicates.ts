import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

const supabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate tenant records...\n');

  // Get all current tenants
  const { data: tenants, error } = await supabase
    .from('tenant_lookup')
    .select('id, name, unit_number, building_address')
    .eq('is_current', true)
    .order('name')
    .order('building_address');

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Total current tenants: ${tenants.length}\n`);

  // Group by name to find duplicates
  const byName = new Map<string, typeof tenants>();
  for (const tenant of tenants) {
    const key = tenant.name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, []);
    }
    byName.get(key)!.push(tenant);
  }

  // Find duplicates
  const duplicates = Array.from(byName.entries())
    .filter(([_, records]) => records.length > 1)
    .slice(0, 10);

  console.log(`Found ${duplicates.length} names with duplicate records\n`);

  for (const [name, records] of duplicates) {
    console.log(`\n${name} (${records.length} records):`);
    for (const r of records) {
      console.log(`  - ${r.building_address} Unit ${r.unit_number} [ID: ${r.id}]`);
    }
  }
}

checkDuplicates();
