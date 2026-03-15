/**
 * Safe CSV Tenant Import Script
 * Imports missing tenants from CSV without deleting or updating existing data
 * Run with: npx tsx scripts/import-csv-tenants.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { join } from 'path';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

const supabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

// Property name mapping from CSV to app building addresses
const propertyNameToAddress: Record<string, string> = {
  "S0001 - 90 Park St": "90 Park Street",
  "S0002 - 101 Maple": "97-103 Maple Ave",
  "S0003 - 222 Maple": "222-224 Maple Ave",
  "S0004 - 43 Frank": "43-45 Franklin Ave",
  "S0005 - 47 Frank": "47 Franklin Ave",
  "S0006 - 15 Whit": "15-17 Whitmore Street",
  "S0007 - 36 Whit": "36 Whitmore Street",
  "S0008 - 38 Whit": "38-40 Whitmore Street",
  "S0010 - 228 Maple": "228 Maple Ave",
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
  "S0023 - 57 Park": "57 Park St",
  "S0025 - 179 Affleck": "179 Affleck St",
  "S0026 - 144 Affleck": "144-146 Affleck St",
  "S0027 - 178 Affleck": "178 Affleck St",
  "S0028 - 182 Affleck": "182 Affleck St",
  "S0029 - 190 Affleck": "190 Affleck St",
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

interface CSVRow {
  'Property Name': string;
  'Unit': string;
  'Tenant': string;
  'Status': string;
  'Tenant Type': string;
  'Phone Numbers': string;
  'Emails': string;
  'Move-in': string;
  'Lease To': string;
  'Rent': string;
  'Deposit': string;
  'Tenant Tags': string;
  'Commercial Lease Type': string;
  'Tenant Integration ID': string;
}

interface TenantRecord {
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  unit_number: string;
  building_address: string;
  move_in: string | null;
  status: string;
  is_current: boolean;
}

function parseName(fullName: string): { first: string | null; last: string | null } {
  if (!fullName || fullName.trim() === '') {
    return { first: null, last: null };
  }

  const trimmed = fullName.trim();
  
  // Check if format is "Last, First"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map(p => p.trim());
    return {
      last: parts[0] || null,
      first: parts[1] || null,
    };
  }

  // Otherwise treat as single name or "First Last"
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: null };
  }
  
  return {
    first: parts[0],
    last: parts.slice(1).join(' '),
  };
}

function extractPhone(phoneString: string): string | null {
  if (!phoneString || phoneString.trim() === '') {
    return null;
  }

  // Extract first phone number found
  // Handles formats like "Mobile: (860) 614-3327" or "Phone: (860) 834-7953, Mobile: (860) 336-7514"
  const phoneMatch = phoneString.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return phoneMatch ? phoneMatch[0].trim() : null;
}

function extractEmail(emailString: string): string | null {
  if (!emailString || emailString.trim() === '') {
    return null;
  }

  // Take first email if multiple
  const emails = emailString.split(',').map(e => e.trim());
  const validEmail = emails.find(e => e.includes('@'));
  return validEmail || null;
}

function parseDate(dateString: string): string | null {
  if (!dateString || dateString.trim() === '') {
    return null;
  }

  try {
    // CSV dates are in MM/DD/YYYY format
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    console.warn(`Could not parse date: ${dateString}`);
  }

  return null;
}

async function importCSVTenants() {
  console.log('🚀 Starting safe CSV tenant import...\n');

  try {
    // Step 1: Load and parse CSV
    console.log('📄 Reading CSV file...');
    const csvPath = join(process.cwd(), 'export', 'tenant_directory-20260313.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVRow[];

    console.log(`✅ Parsed ${records.length} rows from CSV\n`);

    // Step 2: Filter to only "Current" tenants
    console.log('🔍 Filtering to Current tenants only...');
    const currentTenants = records.filter(r => r.Status === 'Current');
    console.log(`✅ Found ${currentTenants.length} current tenants\n`);

    // Step 3: Transform to tenant records
    console.log('🔄 Transforming tenant data...');
    const tenantRecords: TenantRecord[] = [];
    let skippedUnmapped = 0;
    let skippedNoName = 0;

    for (const row of currentTenants) {
      const buildingAddress = propertyNameToAddress[row['Property Name']];
      
      if (!buildingAddress) {
        skippedUnmapped++;
        continue;
      }

      const tenantName = row.Tenant;
      if (!tenantName || tenantName.trim() === '') {
        skippedNoName++;
        continue;
      }

      const { first, last } = parseName(tenantName);
      const phone = extractPhone(row['Phone Numbers']);
      const email = extractEmail(row.Emails);
      const moveIn = parseDate(row['Move-in']);

      tenantRecords.push({
        name: tenantName.trim(),
        first_name: first,
        last_name: last,
        phone,
        email,
        unit_number: row.Unit || '',
        building_address: buildingAddress,
        move_in: moveIn,
        status: 'Current',
        is_current: true,
      });
    }

    console.log(`✅ Transformed ${tenantRecords.length} tenant records`);
    console.log(`   - Skipped ${skippedUnmapped} (unmapped properties)`);
    console.log(`   - Skipped ${skippedNoName} (no tenant name)\n`);

    // Step 4: Fetch existing tenants
    console.log('📦 Fetching existing tenants from database...');
    const { data: existingTenants, error: fetchError } = await supabase
      .from('tenant_lookup')
      .select('name, unit_number, building_address, is_current');

    if (fetchError) throw fetchError;
    console.log(`✅ Found ${existingTenants?.length || 0} existing tenant records\n`);

    // Step 5: Check for existing submissions (verification only)
    console.log('🔍 Verifying submissions table (should remain unchanged)...');
    const { count: submissionsCount } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true });
    console.log(`✅ Current submissions count: ${submissionsCount}\n`);

    // Step 6: Identify missing tenants
    console.log('🔍 Identifying missing tenants...');
    const existingSet = new Set(
      (existingTenants || [])
        .filter(t => t.is_current)
        .map(t => `${t.building_address}|${t.unit_number}|${t.name.toLowerCase()}`)
    );

    const missingTenants = tenantRecords.filter(t => {
      const key = `${t.building_address}|${t.unit_number}|${t.name.toLowerCase()}`;
      return !existingSet.has(key);
    });

    console.log(`✅ Found ${missingTenants.length} missing tenants to import\n`);

    if (missingTenants.length === 0) {
      console.log('✨ No missing tenants to import. All tenants already exist!');
      return;
    }

    // Step 7: Insert missing tenants in batches
    console.log('💾 Inserting missing tenants...');
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < missingTenants.length; i += batchSize) {
      const batch = missingTenants.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('tenant_lookup')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError);
        throw insertError;
      }

      inserted += batch.length;
      console.log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(missingTenants.length / batchSize)} inserted (${inserted}/${missingTenants.length})`);
    }

    console.log(`✅ Successfully inserted ${inserted} new tenants\n`);

    // Step 8: Verify final counts
    console.log('🔍 Verifying final state...');
    
    const { count: finalTenantCount } = await supabase
      .from('tenant_lookup')
      .select('*', { count: 'exact', head: true });

    const { count: finalSubmissionsCount } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true });

    console.log('\n✨ Import complete!\n');
    console.log('📊 Final Statistics:');
    console.log(`   Tenant Lookup Records: ${finalTenantCount}`);
    console.log(`   - Existed before: ${existingTenants?.length || 0}`);
    console.log(`   - Newly added: ${inserted}`);
    console.log(`   Submissions (unchanged): ${finalSubmissionsCount}`);
    console.log(`   - Before: ${submissionsCount}`);
    console.log(`   - After: ${finalSubmissionsCount}`);

    if (submissionsCount !== finalSubmissionsCount) {
      console.warn('\n⚠️  WARNING: Submissions count changed! This should not have happened!');
    } else {
      console.log('\n✅ Submissions table unchanged - data integrity preserved!');
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

importCSVTenants();
