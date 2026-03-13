/**
 * Import historical vehicle data from tenant directory Excel file
 * Matches historical tenants (from ~1 year ago) with current tenants using fuzzy matching
 * Creates submission records for matched tenants with vehicle information
 * Only imports data for assets S0001-S0023
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { compareTwoStrings } from 'string-similarity';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizePlate } from '../lib/plateSanitizer';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

// Production DB - for fetching current tenant names
const prodSupabase = createClient(
  'https://wkwmxxlfheywwbgdbzxe.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrd214eGxmaGV5d3diZ2RienhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwOTcxOTIsImV4cCI6MjA3OTQ1NzE5Mn0.G4UyeP2BVuGG35oGDXMJcgbSCVVtBhSO6WddG-b6bm4'
);

// Test DB - for inserting submission records
const supabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

// Property name → production DB address format (for MATCHING tenants only)
const propertyNameToAddress: Record<string, string> = {
  "S0001 - 90 Park St": "90-100 Park Street Hartford, CT 06106",
  "S0002 - 101 Maple": "97-103 Maple Ave",
  "S0003 - 222 Maple": "222-224 Maple Ave",
  "S0004 - 43 Frank": "43-45 Franklin Ave",
  "S0005 - 47 Frank": "47 Franklin Ave",
  "S0006 - 15 Whit": "15-17 Whitmore Street",
  "S0006 - 15 Whitmore": "15-17 Whitmore Street",
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
  "S0018 - 90 Edwards": "90 Edwards St Hartford, CT 06120",
  "S0019 - 93 Maple": "93-95 Maple Ave",
  "S0020 - 31 Park": "31-33 Park St",
  "S0021 - 67 Park": "67-73 Park St Hartford, CT 06106",
  "S0021 - 69 Park": "67-73 Park St Hartford, CT 06106",
  "S0022 - 83 Park": "83-91 Park St",
  "S0022 - 87 Park": "83-91 Park St",
  "S0023 - 57 Park": "57 Park St",
  "S0023 - 57-59 Park": "57 Park St",
};

// Property name → canonical building address (matches lib/buildings.ts, stored in submissions)
const propertyNameToCanonical: Record<string, string> = {
  "S0001 - 90 Park St": "90 Park Street",
  "S0002 - 101 Maple": "97-103 Maple Ave",
  "S0003 - 222 Maple": "222-224 Maple Ave",
  "S0004 - 43 Frank": "43-45 Franklin Ave",
  "S0005 - 47 Frank": "47 Franklin Ave",
  "S0006 - 15 Whit": "15-17 Whitmore Street",
  "S0006 - 15 Whitmore": "15-17 Whitmore Street",
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
  "S0021 - 69 Park": "67-73 Park St",
  "S0022 - 83 Park": "83-91 Park St",
  "S0022 - 87 Park": "83-91 Park St",
  "S0023 - 57 Park": "57 Park St",
  "S0023 - 57-59 Park": "57 Park St",
};

// Normalize address for matching
function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/street/gi, 'st')
    .replace(/avenue/gi, 'ave')
    .replace(/road/gi, 'rd')
    .replace(/\./g, '');
}

// Normalize unit number for matching
function normalizeUnit(unit: string | number | null | undefined): string {
  if (!unit) return '';
  const unitStr = String(unit);
  return unitStr
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/unit/gi, '')
    .replace(/#/g, '')
    .replace(/apt/gi, '')
    .replace(/-/g, '');
}

// Convert production DB address to standardized format (remove city/state/zip)
function standardizeAddress(address: string): string {
  // Remove Hartford, CT and zip code
  return address
    .replace(/\s+Hartford,?\s+CT\s+\d{5}/gi, '')
    .trim();
}

// Parse vehicle string (e.g., "2011 Dodge Nitro Truck")
interface ParsedVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
}

function parseVehicleString(vehicleStr: string | null): ParsedVehicle {
  if (!vehicleStr || vehicleStr.trim() === '') {
    return { year: null, make: null, model: null };
  }

  const trimmed = vehicleStr.trim();
  
  // Extract year (first 4-digit number)
  const yearMatch = trimmed.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;
  
  // Remove year from string to get make/model
  let remaining = year ? trimmed.replace(yearMatch![0], '').trim() : trimmed;
  
  // Split remaining into words
  const words = remaining.split(/\s+/).filter(w => w.length > 0);
  
  if (words.length === 0) {
    return { year, make: null, model: null };
  }
  
  // First word is make, rest is model
  const make = words[0];
  const model = words.slice(1).join(' ') || null;
  
  return { year, make, model };
}

// Calculate name similarity
function calculateNameSimilarity(
  firstName1: string | null,
  lastName1: string | null,
  firstName2: string | null,
  lastName2: string | null
): number {
  const name1 = `${firstName1 || ''} ${lastName1 || ''}`.trim().toLowerCase();
  const name2 = `${firstName2 || ''} ${lastName2 || ''}`.trim().toLowerCase();
  
  if (!name1 || !name2) return 0;
  
  return compareTwoStrings(name1, name2);
}

interface HistoricalTenant {
  firstName: string;
  lastName: string;
  organization: string;
  address1: string;
  address2: string; // This is the unit
  phone: string;
  car1MakeModel: string | null;
  car1Color: string | null;
  car1Plate: string | null;
  car2MakeModel: string | null;
  car2Color: string | null;
  car2Plate: string | null;
  car3MakeModel: string | null;
  car3Color: string | null;
  car3Plate: string | null;
}

interface MatchResult {
  historical: HistoricalTenant;
  currentTenant: any;
  similarity: number;
  matched: boolean;
  buildingAddress: string; // raw address1 used for matching
  canonicalAddress: string; // canonical address stored in submissions (matches lib/buildings.ts)
  unitNumber: string;
}

async function importHistoricalVehicles() {
  console.log('🚀 Importing historical vehicle data...\n');

  try {
    // Read Excel file
    console.log('📦 Reading Excel file...');
    const workbook = XLSX.readFile('tenant_directory-20250513 (Version2).xlsx');
    const sheet = workbook.Sheets['Sheet2'];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Extract headers and data rows
    const headers = data[0] as string[];
    const rows = data.slice(1);

    console.log(`✅ Found ${rows.length} rows in Excel file\n`);

    // Parse historical tenants
    console.log('🔄 Parsing historical tenant data...');
    const historicalTenants: HistoricalTenant[] = [];

    for (const row of rows) {
      const organization = row[2]; // Organization column
      
      // Filter to S0001-S0023 only
      if (!organization || !organization.toString().match(/^S00(0[1-9]|1[0-9]|2[0-3])\s/)) {
        continue;
      }

      const tenant: HistoricalTenant = {
        firstName: row[0] || '',
        lastName: row[1] || '',
        organization: organization,
        address1: row[3] || '', // Actual street address (e.g., "96 Park Street")
        address2: row[4] || '', // Unit number
        phone: row[9] || '',
        car1MakeModel: row[10] || null,
        car1Color: row[11] || null,
        car1Plate: row[12] || null,
        car2MakeModel: row[13] || null,
        car2Color: row[14] || null,
        car2Plate: row[15] || null,
        car3MakeModel: row[16] || null,
        car3Color: row[17] || null,
        car3Plate: row[18] || null,
      };

      // Only include tenants with at least one vehicle
      if (tenant.car1MakeModel || tenant.car2MakeModel || tenant.car3MakeModel) {
        historicalTenants.push(tenant);
      }
    }

    console.log(`✅ Found ${historicalTenants.length} historical tenants with vehicles (S0001-S0023)\n`);

    // Fetch current tenants from production database
    console.log('📦 Fetching current tenants from production database...');
    const { data: currentTenants, error } = await prodSupabase
      .from('tenants')
      .select('name, first_name, last_name, phone_numbers, email, unit, property_address, move_in, status, is_current')
      .eq('is_current', true);

    if (error) throw error;
    console.log(`✅ Fetched ${currentTenants.length} current tenants\n`);

    // Debug: Show unique property addresses for S0001-S0023
    const uniqueAddresses = new Set(currentTenants.map(t => t.property_address).filter(a => a));
    console.log('🔍 Sample property addresses in production DB:');
    Array.from(uniqueAddresses)
      .filter(addr => addr.includes('Park') || addr.includes('90'))
      .slice(0, 5)
      .forEach(addr => console.log(`   - ${addr}`));
    console.log();

    // Match historical tenants with current tenants
    console.log('🔍 Matching historical tenants with current tenants...');
    const matches: MatchResult[] = [];
    const SIMILARITY_THRESHOLD = 0.80;

    for (const historical of historicalTenants) {
      // Use Address1 (actual street address) for matching instead of property code
      // Address1 contains the actual street address like "96 Park Street"
      const buildingAddress = historical.address1;
      if (!buildingAddress) {
        console.warn(`⚠️  No address for: ${historical.firstName} ${historical.lastName}`);
        continue;
      }

      const normalizedBuilding = normalizeAddress(buildingAddress);
      const normalizedUnit = normalizeUnit(historical.address2);

      // Find current tenants in same building and unit
      const candidates = currentTenants.filter(t => {
        const tenantBuilding = normalizeAddress(t.property_address || '');
        const tenantUnit = normalizeUnit(t.unit || '');
        
        // More flexible building matching for consolidated addresses
        // e.g., "94 Park Street" should match "90-100 Park Street"
        let buildingMatch = tenantBuilding.includes(normalizedBuilding) || 
                           normalizedBuilding.includes(tenantBuilding);
        
        // Special handling for Park Street addresses (90-100 range)
        if (!buildingMatch && normalizedBuilding.includes('park st')) {
          // Extract street number from historical address (e.g., "94" from "94 Park Street")
          const historicalNumMatch = normalizedBuilding.match(/^(\d+)/);
          if (historicalNumMatch) {
            const num = parseInt(historicalNumMatch[1]);
            // Check if it falls within 90-100 range
            if (num >= 90 && num <= 100 && tenantBuilding.includes('90-100 park st')) {
              buildingMatch = true;
            }
          }
        }
        
        const unitMatch = tenantUnit === normalizedUnit;
        
        return buildingMatch && unitMatch;
      });

      // Debug first few mismatches
      if (candidates.length === 0 && matches.length < 3) {
        console.log(`\n🔍 Debug mismatch for ${historical.firstName} ${historical.lastName}:`);
        console.log(`   Historical: ${buildingAddress} / ${historical.address2}`);
        console.log(`   Normalized: ${normalizedBuilding} / ${normalizedUnit}`);
        
        // Find tenants in same building
        const buildingTenants = currentTenants.filter(t => {
          const tenantBuilding = normalizeAddress(t.property_address || '');
          return tenantBuilding.includes(normalizedBuilding) || normalizedBuilding.includes(tenantBuilding);
        });
        
        if (buildingTenants.length > 0) {
          console.log(`   Found ${buildingTenants.length} tenants in building:`);
          buildingTenants.slice(0, 3).forEach(t => {
            console.log(`     - ${t.name || `${t.first_name} ${t.last_name}`} in unit ${t.unit} (normalized: ${normalizeUnit(t.unit)})`);
          });
        } else {
          console.log(`   No tenants found in building ${normalizedBuilding}`);
        }
      }

      if (candidates.length === 0) {
        matches.push({
          historical,
          currentTenant: null,
          similarity: 0,
          matched: false,
          buildingAddress,
          canonicalAddress: propertyNameToCanonical[historical.organization] || buildingAddress,
          unitNumber: historical.address2,
        });
        continue;
      }

      // Calculate name similarity for each candidate
      let bestMatch = null;
      let bestSimilarity = 0;

      for (const candidate of candidates) {
        const similarity = calculateNameSimilarity(
          historical.firstName,
          historical.lastName,
          candidate.first_name,
          candidate.last_name
        );

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = candidate;
        }
      }

      const matched = bestSimilarity >= SIMILARITY_THRESHOLD;

      matches.push({
        historical,
        currentTenant: bestMatch,
        similarity: bestSimilarity,
        matched,
        buildingAddress,
        canonicalAddress: propertyNameToCanonical[historical.organization] || buildingAddress,
        unitNumber: historical.address2,
      });
    }

    const matchedCount = matches.filter(m => m.matched).length;
    const unmatchedCount = matches.filter(m => !m.matched).length;

    console.log(`✅ Matching complete:`);
    console.log(`   - Matched: ${matchedCount}`);
    console.log(`   - Unmatched (skipped): ${unmatchedCount}\n`);

    // Create submission records for matched tenants
    console.log('💾 Creating submission records...');
    const submissions = [];

    for (const match of matches) {
      if (!match.matched) continue; // Skip unmatched

      const { historical, currentTenant } = match;

      // Parse vehicles
      const car1 = parseVehicleString(historical.car1MakeModel);
      const car2 = parseVehicleString(historical.car2MakeModel);
      const car3 = parseVehicleString(historical.car3MakeModel);

      // Build additional_vehicles array
      const additionalVehicles = [];
      if (car2.make) {
        additionalVehicles.push({
          vehicle_make: car2.make,
          vehicle_model: car2.model,
          vehicle_year: car2.year,
          vehicle_color: historical.car2Color,
          vehicle_plate: sanitizePlate(historical.car2Plate),
          requested_at: new Date('2025-05-13').toISOString(),
        });
      }
      if (car3.make) {
        additionalVehicles.push({
          vehicle_make: car3.make,
          vehicle_model: car3.model,
          vehicle_year: car3.year,
          vehicle_color: historical.car3Color,
          vehicle_plate: sanitizePlate(historical.car3Plate),
          requested_at: new Date('2025-05-13').toISOString(),
        });
      }

      const submission = {
        full_name: currentTenant.name || `${currentTenant.first_name} ${currentTenant.last_name}`.trim(),
        phone: historical.phone || currentTenant.phone_numbers,
        email: currentTenant.email,
        building_address: match.canonicalAddress,
        unit_number: currentTenant.unit,
        has_vehicle: true,
        vehicle_make: car1.make,
        vehicle_model: car1.model,
        vehicle_year: car1.year,
        vehicle_color: historical.car1Color,
        vehicle_plate: sanitizePlate(historical.car1Plate),
        additional_vehicles: additionalVehicles.length > 0 ? additionalVehicles : null,
        created_at: new Date('2025-05-13T16:01:00').toISOString(),
        ip_address: 'HISTORICAL_IMPORT',
        user_agent: 'Import Script - Historical Vehicle Data',
      };

      submissions.push(submission);
    }

    console.log(`✅ Prepared ${submissions.length} submission records\n`);

    // Insert submissions in batches
    if (submissions.length > 0) {
      console.log('💾 Inserting submissions into database...');
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < submissions.length; i += batchSize) {
        const batch = submissions.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('submissions')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, insertError);
          throw insertError;
        }

        insertedCount += batch.length;
        console.log(`  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(submissions.length / batchSize)} inserted`);
      }

      console.log(`✅ Inserted ${insertedCount} submission records\n`);
    }

    // Generate CSV report
    console.log('📊 Generating import report...');
    const reportRows = [
      ['Historical Name', 'Current Name', 'Building', 'Unit', 'Match Status', 'Similarity', 'Vehicles Imported', 'Car1', 'Car2', 'Car3']
    ];

    for (const match of matches) {
      const historicalName = `${match.historical.firstName} ${match.historical.lastName}`;
      const currentName = match.currentTenant 
        ? (match.currentTenant.name || `${match.currentTenant.first_name} ${match.currentTenant.last_name}`)
        : 'N/A';
      
      const vehicleCount = [
        match.historical.car1MakeModel,
        match.historical.car2MakeModel,
        match.historical.car3MakeModel
      ].filter(v => v).length;

      reportRows.push([
        historicalName,
        currentName,
        match.buildingAddress,
        match.unitNumber,
        match.matched ? 'MATCHED' : 'SKIPPED',
        (match.similarity * 100).toFixed(1) + '%',
        match.matched ? vehicleCount.toString() : '0',
        match.historical.car1MakeModel || '',
        match.historical.car2MakeModel || '',
        match.historical.car3MakeModel || '',
      ]);
    }

    // Create export directory if it doesn't exist
    const exportDir = path.join(process.cwd(), 'export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const reportPath = path.join(exportDir, `historical-vehicle-import-${new Date().toISOString().split('T')[0]}.csv`);
    const csvContent = reportRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    fs.writeFileSync(reportPath, csvContent);

    console.log(`✅ Report saved to: ${reportPath}\n`);

    // Print summary statistics
    console.log('✨ Import complete!\n');
    console.log('📈 Summary:');
    console.log(`   Total historical records: ${historicalTenants.length}`);
    console.log(`   Matched tenants: ${matchedCount}`);
    console.log(`   Unmatched (skipped): ${unmatchedCount}`);
    console.log(`   Submissions created: ${submissions.length}`);
    console.log(`   Total vehicles imported: ${submissions.reduce((sum, s) => {
      return sum + 1 + (s.additional_vehicles ? s.additional_vehicles.length : 0);
    }, 0)}`);

    // Summary by building
    const buildingStats: Record<string, number> = {};
    for (const match of matches.filter(m => m.matched)) {
      buildingStats[match.buildingAddress] = (buildingStats[match.buildingAddress] || 0) + 1;
    }

    console.log('\n📊 Matched tenants by building:');
    Object.entries(buildingStats)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([building, count]) => {
        console.log(`   ${building}: ${count}`);
      });

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importHistoricalVehicles();
