#!/usr/bin/env tsx
/**
 * scripts/backfill-intake-snapshots.ts
 *
 * F6: Backfill intake_snapshot for existing completed applications.
 *
 * Usage:
 *   npx tsx scripts/backfill-intake-snapshots.ts           # Dry run (default)
 *   npx tsx scripts/backfill-intake-snapshots.ts --commit  # Execute updates
 *
 * For each pbv_full_applications row where intake_status='complete' AND intake_snapshot IS NULL:
 *   - Copies intake_data → intake_snapshot
 *   - Sets intake_snapshot_at = COALESCE(submitted_at, updated_at, NOW())
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COMMIT = process.argv.includes('--commit');

async function main() {
  console.log(`[backfill-intake-snapshots] Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  console.log('');

  // Fetch all completed applications without a snapshot
  const { data: rows, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, submitted_at, updated_at, intake_data, head_of_household_name')
    .eq('intake_status', 'complete')
    .is('intake_snapshot', null);

  if (error) {
    console.error('Failed to fetch rows:', error);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No rows need backfill. All completed applications already have intake_snapshot.');
    process.exit(0);
  }

  console.log(`Found ${rows.length} row(s) to backfill:`);
  console.log('');

  // Show sample of first 5 rows
  const sampleSize = Math.min(5, rows.length);
  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];
    const hohName = row.head_of_household_name ?? 'Unknown';
    const dataPreview = JSON.stringify(row.intake_data).slice(0, 100) + '...';
    console.log(`  ${i + 1}. ${row.id} (HOH: ${hohName})`);
    console.log(`     Data preview: ${dataPreview}`);
    console.log('');
  }

  if (rows.length > sampleSize) {
    console.log(`  ... and ${rows.length - sampleSize} more row(s)`);
    console.log('');
  }

  if (!COMMIT) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('This was a DRY-RUN. No changes were made.');
    console.log('Run with --commit to execute the backfill.');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`Summary: Would update ${rows.length} row(s)`);
    process.exit(0);
  }

  // Execute the backfill
  console.log('Executing backfill...');
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const snapshotAt = row.submitted_at ?? row.updated_at ?? new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        intake_snapshot: row.intake_data,
        intake_snapshot_at: snapshotAt,
      })
      .eq('id', row.id);

    if (updateError) {
      console.error(`  ✗ Failed to update ${row.id}:`, updateError.message);
      errorCount++;
    } else {
      console.log(`  ✓ Updated ${row.id}`);
      successCount++;
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Backfill complete!');
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log('═══════════════════════════════════════════════════════════════');

  process.exit(errorCount > 0 ? 1 : 0);
}

main();
