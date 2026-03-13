/**
 * Clean vehicle plate data by removing UTF-8 encoding corruption
 * Run with: npx tsx scripts/clean-vehicle-plates.ts [--apply]
 * Without --apply flag, runs in preview mode only
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { sanitizePlate } from '../lib/plateSanitizer';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

const supabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

interface PlateChange {
  id: string;
  fullName: string;
  building: string;
  unit: string;
  oldPlate: string;
  newPlate: string;
  field: 'primary' | 'additional';
  additionalIndex?: number;
}

async function cleanVehiclePlates() {
  const applyChanges = process.argv.includes('--apply');
  
  console.log('🧹 Vehicle Plate Cleaning Script\n');
  console.log(`Mode: ${applyChanges ? '✅ APPLY CHANGES' : '👁️  PREVIEW ONLY'}\n`);
  
  try {
    // Fetch all submissions with vehicles
    console.log('📦 Fetching submissions with vehicles...');
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('id, full_name, building_address, unit_number, vehicle_plate, additional_vehicles')
      .eq('has_vehicle', true);
    
    if (error) throw error;
    console.log(`✅ Found ${submissions.length} submissions with vehicles\n`);
    
    const changes: PlateChange[] = [];
    
    // Check primary vehicle plates
    for (const sub of submissions) {
      if (sub.vehicle_plate) {
        const cleaned = sanitizePlate(sub.vehicle_plate);
        if (cleaned !== sub.vehicle_plate) {
          changes.push({
            id: sub.id,
            fullName: sub.full_name || 'Unknown',
            building: sub.building_address || 'Unknown',
            unit: sub.unit_number || 'Unknown',
            oldPlate: sub.vehicle_plate,
            newPlate: cleaned,
            field: 'primary',
          });
        }
      }
      
      // Check additional vehicles
      if (sub.additional_vehicles && Array.isArray(sub.additional_vehicles)) {
        for (let i = 0; i < sub.additional_vehicles.length; i++) {
          const vehicle = sub.additional_vehicles[i];
          if (vehicle.vehicle_plate) {
            const cleaned = sanitizePlate(vehicle.vehicle_plate);
            if (cleaned !== vehicle.vehicle_plate) {
              changes.push({
                id: sub.id,
                fullName: sub.full_name || 'Unknown',
                building: sub.building_address || 'Unknown',
                unit: sub.unit_number || 'Unknown',
                oldPlate: vehicle.vehicle_plate,
                newPlate: cleaned,
                field: 'additional',
                additionalIndex: i,
              });
            }
          }
        }
      }
    }
    
    if (changes.length === 0) {
      console.log('✨ No corrupted plates found! All plates are clean.\n');
      return;
    }
    
    // Display changes
    console.log(`🔍 Found ${changes.length} plates that need cleaning:\n`);
    console.log('─'.repeat(100));
    console.log('Tenant'.padEnd(25) + 'Building'.padEnd(20) + 'Unit'.padEnd(8) + 'Before'.padEnd(20) + '→ After');
    console.log('─'.repeat(100));
    
    for (const change of changes) {
      const type = change.field === 'additional' ? ` (Add #${change.additionalIndex! + 1})` : '';
      console.log(
        change.fullName.substring(0, 24).padEnd(25) +
        change.building.substring(0, 19).padEnd(20) +
        change.unit.substring(0, 7).padEnd(8) +
        change.oldPlate.substring(0, 19).padEnd(20) +
        `→ ${change.newPlate}${type}`
      );
    }
    console.log('─'.repeat(100));
    console.log(`\nTotal: ${changes.length} plates to clean\n`);
    
    if (!applyChanges) {
      console.log('💡 This was a preview. To apply changes, run:');
      console.log('   npx tsx scripts/clean-vehicle-plates.ts --apply\n');
      return;
    }
    
    // Apply changes
    console.log('💾 Applying changes...\n');
    let updatedCount = 0;
    
    for (const change of changes) {
      try {
        if (change.field === 'primary') {
          // Update primary vehicle plate
          const { error: updateError } = await supabase
            .from('submissions')
            .update({ vehicle_plate: change.newPlate })
            .eq('id', change.id);
          
          if (updateError) {
            console.error(`❌ Error updating ${change.fullName}: ${updateError.message}`);
            continue;
          }
        } else {
          // Update additional vehicle plate
          const { data: current, error: fetchError } = await supabase
            .from('submissions')
            .select('additional_vehicles')
            .eq('id', change.id)
            .single();
          
          if (fetchError || !current) {
            console.error(`❌ Error fetching ${change.fullName}: ${fetchError?.message}`);
            continue;
          }
          
          const additionalVehicles = current.additional_vehicles as any[];
          if (additionalVehicles && change.additionalIndex !== undefined) {
            additionalVehicles[change.additionalIndex].vehicle_plate = change.newPlate;
            
            const { error: updateError } = await supabase
              .from('submissions')
              .update({ additional_vehicles: additionalVehicles })
              .eq('id', change.id);
            
            if (updateError) {
              console.error(`❌ Error updating ${change.fullName}: ${updateError.message}`);
              continue;
            }
          }
        }
        
        updatedCount++;
        if (updatedCount % 10 === 0) {
          console.log(`  ✓ Updated ${updatedCount}/${changes.length}...`);
        }
      } catch (err: any) {
        console.error(`❌ Error processing ${change.fullName}: ${err.message}`);
      }
    }
    
    console.log(`\n✅ Successfully cleaned ${updatedCount} of ${changes.length} plates\n`);
    
  } catch (error: any) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

cleanVehiclePlates();
