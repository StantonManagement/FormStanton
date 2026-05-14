/**
 * cleanup-intake-staging.ts
 *
 * Removes staging files from `intake-staging` bucket for batches that have been
 * committed or abandoned more than N days ago.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-intake-staging.ts [--days=7] [--dry-run]
 */

import { supabaseAdmin } from '../lib/supabase';

const RETENTION_DAYS = parseInt(
  process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? '7',
  10
);
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();

  console.log(
    `Cleaning intake-staging files for batches committed/abandoned before ${cutoffIso}${DRY_RUN ? ' [DRY RUN]' : ''}`
  );

  const { data: batches, error: batchErr } = await supabaseAdmin
    .from('intake_batches')
    .select('id, status, committed_at, created_at')
    .in('status', ['committed', 'abandoned'])
    .lt('updated_at', cutoffIso);

  if (batchErr) {
    console.error('Failed to query batches:', batchErr);
    process.exit(1);
  }

  if (!batches || batches.length === 0) {
    console.log('No batches to clean.');
    return;
  }

  console.log(`Found ${batches.length} batch(es) to clean.`);
  let totalRemoved = 0;

  for (const batch of batches) {
    const { data: pages, error: pagesErr } = await supabaseAdmin
      .from('intake_pages')
      .select('image_path')
      .eq('batch_id', batch.id);

    if (pagesErr) {
      console.error(`Failed to fetch pages for batch ${batch.id}:`, pagesErr);
      continue;
    }

    const paths = (pages ?? [])
      .map((p: { image_path: string | null }) => p.image_path)
      .filter((p): p is string => !!p);

    if (paths.length === 0) {
      console.log(`  Batch ${batch.id}: no pages — skipping.`);
      continue;
    }

    console.log(`  Batch ${batch.id}: removing ${paths.length} file(s)…`);

    if (!DRY_RUN) {
      const { error: removeErr } = await supabaseAdmin.storage
        .from('intake-staging')
        .remove(paths);

      if (removeErr) {
        console.error(`  Failed to remove files for batch ${batch.id}:`, removeErr);
      } else {
        totalRemoved += paths.length;
      }
    } else {
      paths.forEach((p) => console.log(`    [dry] would remove: ${p}`));
      totalRemoved += paths.length;
    }
  }

  console.log(`Done. ${totalRemoved} file(s) ${DRY_RUN ? 'would be' : 'were'} removed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
