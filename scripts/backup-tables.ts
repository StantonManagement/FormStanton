import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

config({ path: '.env' });
config({ path: '.env.local', override: true });

const cleanEnv = (value: string | undefined) => value?.replace(/^["']|["']$/g, '');

const supabase = createClient(
  cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || '',
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || ''
);

async function backupTables() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = join(process.cwd(), 'backups');

  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  console.log(`\n=== DATABASE BACKUP — ${timestamp} ===\n`);

  // Backup submissions
  console.log('Backing up submissions table...');
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('*');

  if (subError) {
    console.error('FAILED to fetch submissions:', subError);
    process.exit(1);
  }

  const subPath = join(backupDir, `submissions-${timestamp}.json`);
  writeFileSync(subPath, JSON.stringify(submissions, null, 2));
  console.log(`  submissions: ${submissions.length} rows -> ${subPath}`);

  // Backup tenant_lookup
  console.log('Backing up tenant_lookup table...');
  const { data: tenants, error: tenantError } = await supabase
    .from('tenant_lookup')
    .select('*');

  if (tenantError) {
    console.error('FAILED to fetch tenant_lookup:', tenantError);
    process.exit(1);
  }

  const tenantPath = join(backupDir, `tenant_lookup-${timestamp}.json`);
  writeFileSync(tenantPath, JSON.stringify(tenants, null, 2));
  console.log(`  tenant_lookup: ${tenants.length} rows -> ${tenantPath}`);

  // Verify files
  console.log('\n=== VERIFICATION ===');
  const subFileExists = existsSync(subPath);
  const tenantFileExists = existsSync(tenantPath);

  console.log(`  submissions backup exists: ${subFileExists ? 'YES' : 'NO'}`);
  console.log(`  tenant_lookup backup exists: ${tenantFileExists ? 'YES' : 'NO'}`);
  console.log(`  submissions rows: ${submissions.length}`);
  console.log(`  tenant_lookup rows: ${tenants.length}`);

  if (subFileExists && tenantFileExists && submissions.length > 0 && tenants.length > 0) {
    console.log('\n=== BACKUP COMPLETE — SAFE TO PROCEED ===\n');
  } else {
    console.error('\n=== BACKUP FAILED — DO NOT PROCEED ===\n');
    process.exit(1);
  }
}

backupTables();
