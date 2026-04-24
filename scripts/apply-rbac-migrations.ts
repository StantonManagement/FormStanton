import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://lieeeqqvshobnqofcdac.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceRoleKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const migrations = [
  '20260423200000_rbac_permissions_system.sql',
  '20260423201000_rbac_seed_data.sql',
];

async function applyMigration(filename: string) {
  const filePath = path.join(process.cwd(), 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`\nApplying: ${filename}`);

  const { error } = await (supabase as any).rpc('exec_sql', { sql_string: sql });

  if (error) {
    // Fallback: try splitting by statements
    console.log('  RPC exec_sql not available, splitting statements...');
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      const { error: stmtError } = await (supabase as any).rpc('exec_sql', {
        sql_string: stmt + ';',
      });
      if (stmtError) {
        console.error(`  ERROR on statement: ${stmt.slice(0, 80)}...`);
        console.error(`  ${stmtError.message}`);
      }
    }
  } else {
    console.log(`  OK`);
  }
}

async function main() {
  for (const migration of migrations) {
    await applyMigration(migration);
  }
  console.log('\nDone.');
}

main().catch(console.error);
