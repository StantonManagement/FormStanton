// Apply 2026-05-21 PBV migration batch
// Run with: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-2026-05-21-batch.mjs
// Requires: SUPABASE_ACCESS_TOKEN env var (from app.supabase.com/account/tokens)

import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const clean = (v) => v?.replace(/^["']|["']$/g, '') ?? '';

const projectRef = clean(process.env.NEXT_PUBLIC_SUPABASE_URL)
  .replace('https://', '')
  .replace('.supabase.co', '');

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!accessToken) {
  console.error(
    '\nERROR: SUPABASE_ACCESS_TOKEN is required.\n' +
    'Get yours at: https://app.supabase.com/account/tokens\n' +
    'Then run: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-2026-05-21-batch.mjs\n'
  );
  process.exit(1);
}

// 2026-05-21 batch in timestamp order
// PRD-72 (display_name_pt backfill) deliberately EXCLUDED — gated on native PT review
const migrations = [
  'supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql', // PRD-55b
  'supabase/migrations/20260521010000_prd62_unsigned_pdf_hash.sql',          // PRD-62
  'supabase/migrations/20260521020000_finalize_pbv_application_fn.sql',    // PRD-64
  'supabase/migrations/20260521030000_prd65_government_id_required.sql',     // PRD-65
  'supabase/migrations/20260521040000_prd66_form_generation_version.sql',    // PRD-66
  'supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql', // PRD-69
];

async function runSQL(sql) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

async function main() {
  console.log(`\nProject: ${projectRef}\n`);
  console.log(`Applying ${migrations.length} migrations from 2026-05-21 batch...`);
  console.log('(PRD-72 PT backfill excluded — pending native review)\n');

  for (const file of migrations) {
    const sql = readFileSync(file, 'utf8');
    console.log(`Applying: ${file}`);
    try {
      await runSQL(sql);
      console.log(`  ✓ OK\n`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log('All 2026-05-21 batch migrations applied successfully.\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
