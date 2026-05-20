// Apply PRD-24 PBV Form Execution migrations
// Run with: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-prd24-migrations.mjs
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
    'Then run: SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-prd24-migrations.mjs\n'
  );
  process.exit(1);
}

const migrations = [
  'supabase/migrations/20260515000000_pbv_form_execution_columns.sql',
  'supabase/migrations/20260515010000_pbv_form_documents.sql',
  'supabase/migrations/20260515020000_pbv_signature_events.sql',
  'supabase/migrations/20260515030000_pbv_summary_documents.sql',
  'supabase/migrations/20260515040000_pbv_form_templates.sql',
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

  console.log('All PRD-24 migrations applied successfully.\n');
  console.log('Verify with:\n  SELECT form_id, generation_enabled FROM public.pbv_form_templates ORDER BY form_id;\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
