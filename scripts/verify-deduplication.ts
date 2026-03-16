import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { normalizeAddress } from '../lib/addressNormalizer';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

const supabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

function normalizeForMatching(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function verifyDeduplication() {
  console.log('🔍 Verifying deduplication logic...\n');

  // Get all current tenants
  const { data: tenants, error } = await supabase
    .from('tenant_lookup')
    .select('id, name, unit_number, building_address')
    .eq('is_current', true);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`📊 Total tenant_lookup records (is_current=true): ${tenants.length}`);

  // Deduplicate using same logic as unified-tenants API
  const tenantMap = new Map<string, typeof tenants[0]>();
  
  for (const tenant of tenants) {
    const normalizedAddr = normalizeAddress(tenant.building_address).toLowerCase();
    const key = `${normalizedAddr}_${normalizeForMatching(tenant.unit_number)}_${normalizeForMatching(tenant.name)}`;
    
    if (!tenantMap.has(key)) {
      tenantMap.set(key, tenant);
    }
  }

  const uniqueTenants = Array.from(tenantMap.values());
  const duplicatesRemoved = tenants.length - uniqueTenants.length;

  console.log(`✅ Unique tenants after deduplication: ${uniqueTenants.length}`);
  console.log(`🗑️  Duplicates merged: ${duplicatesRemoved}`);
  console.log(`📈 Reduction: ${((duplicatesRemoved / tenants.length) * 100).toFixed(1)}%\n`);

  // Show some examples of merged tenants
  console.log('Example merged tenants:');
  const examples = ['adger', 'aguilar', 'schuler'].map(name => 
    tenants.filter(t => t.name.toLowerCase().includes(name))
  ).filter(group => group.length > 1).slice(0, 3);

  for (const group of examples) {
    const first = group[0];
    const normalizedAddr = normalizeAddress(first.building_address);
    const key = `${normalizedAddr.toLowerCase()}_${normalizeForMatching(first.unit_number)}_${normalizeForMatching(first.name)}`;
    
    console.log(`\n${first.name} (${group.length} records -> 1 unique):`);
    for (const t of group) {
      console.log(`  - ${t.building_address} Unit ${t.unit_number}`);
    }
    console.log(`  Normalized key: ${key}`);
  }
}

verifyDeduplication();
