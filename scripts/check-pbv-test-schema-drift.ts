/**
 * check-pbv-test-schema-drift.ts
 *
 * Verifies test-schema parity for PBV tables only. This is NOT a general
 * schema drift check for the codebase. It compares the hand-maintained
 * MINIMAL_SCHEMA constant in lib/__tests__/_db.ts against the live production
 * database for exactly two tables: pbv_full_applications and application_events.
 *
 * Stub tables (form_submissions, form_submission_documents,
 * form_submission_document_revisions, admin_users) are intentionally divergent
 * from production and are NOT checked here.
 *
 * Usage:
 *   npx tsx scripts/check-pbv-test-schema-drift.ts
 *
 * Exits 0 on no drift, 1 on any drift or connection failure.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Requires SUPABASE_ACCESS_TOKEN (personal access token) or alternatively
 * connects via the Supabase pg wire protocol using DATABASE_URL.
 *
 * Implementation note:
 *   Supabase does not expose information_schema via PostgREST. This script
 *   uses the Supabase Management API (/v1/projects/{ref}/database/query)
 *   which accepts raw SQL and returns results. Requires a personal access
 *   token (SUPABASE_ACCESS_TOKEN) with project-level access.
 *
 *   If SUPABASE_ACCESS_TOKEN is not available, set DATABASE_URL to the
 *   Supabase direct connection string and the script will use pg directly.
 */

import { config as dotenvConfig } from 'dotenv';
import { MINIMAL_SCHEMA } from '../lib/__tests__/_db';

dotenvConfig({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const DATABASE_URL = process.env.DATABASE_URL ?? '';

// Extract project ref from URL (e.g. https://lieeeqqvshobnqofcdac.supabase.co)
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';

if (!PROJECT_REF && !DATABASE_URL) {
  console.error('ERROR: Cannot determine project ref from SUPABASE_URL, and DATABASE_URL not set.');
  process.exit(1);
}

// --- SQL executor -------------------------------------------------------------

async function execSql<T>(sql: string): Promise<T[]> {
  if (ACCESS_TOKEN && PROJECT_REF) {
    // Use Supabase Management API
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ query: sql }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Management API query failed: ${res.status} ${body}`);
    }
    const json = await res.json() as { rows: T[] } | T[];
    return Array.isArray(json) ? json : (json as any).rows ?? [];
  }

  if (DATABASE_URL) {
    // Use pg directly
    const { default: pg } = await import('pg');
    const client = new pg.Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query(sql);
      return result.rows as T[];
    } finally {
      await client.end();
    }
  }

  throw new Error(
    'No SQL connection method available. Set SUPABASE_ACCESS_TOKEN or DATABASE_URL.'
  );
}

// --- Schema parser ------------------------------------------------------------

interface ColInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

/**
 * Extracts column definitions from a CREATE TABLE block in the schema string.
 * Simple line-by-line parser — sufficient for the structured DDL in MINIMAL_SCHEMA.
 */
function parseSchemaColumns(schema: string, tableName: string): ColInfo[] {
  const tableRegex = new RegExp(
    `CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+${tableName}\\s*\\(([\\s\\S]*?)\\)\\s*;`,
    'i'
  );
  const match = schema.match(tableRegex);
  if (!match) return [];

  const body = match[1];
  const lines = body.split('\n').map((l) => l.trim()).filter((l) => {
    if (!l || l.startsWith('--')) return false;
    if (/^(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|CONSTRAINT)\b/i.test(l)) return false;
    return true;
  });

  const columns: ColInfo[] = [];

  for (const line of lines) {
    const clean = line.replace(/,\s*$/, '').trim();
    if (!clean || clean.startsWith('--')) continue;

    const parts = clean.split(/\s+/);
    const colName = parts[0].toLowerCase();
    if (!colName) continue;

    const isNullable = /\bNOT\s+NULL\b/i.test(clean) ? 'NO' : 'YES';
    const typeStr = parts.slice(1).join(' ').toUpperCase();

    let dataType = 'text';
    if (/\bUUID\b/.test(typeStr)) dataType = 'uuid';
    else if (/\bTIMESTAMPTZ\b|\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b/.test(typeStr)) dataType = 'timestamp with time zone';
    else if (/\bTIMESTAMP\b/.test(typeStr)) dataType = 'timestamp without time zone';
    else if (/\bDATE\b/.test(typeStr)) dataType = 'date';
    else if (/\bJSONB\b/.test(typeStr)) dataType = 'jsonb';
    else if (/\bINTEGER\b|\bINT\b/.test(typeStr)) dataType = 'integer';
    else if (/\bNUMERIC\b|\bDECIMAL\b/.test(typeStr)) dataType = 'numeric';
    else if (/\bBOOLEAN\b|\bBOOL\b/.test(typeStr)) dataType = 'boolean';
    else if (/\bTEXT\b/.test(typeStr)) dataType = 'text';

    columns.push({ column_name: colName, data_type: dataType, is_nullable: isNullable });
  }

  return columns;
}

// --- Comparator ---------------------------------------------------------------

function compareColumns(tableName: string, local: ColInfo[], production: ColInfo[]): boolean {
  let drifted = false;
  const localMap = new Map(local.map((c) => [c.column_name, c]));
  const prodMap = new Map(production.map((c) => [c.column_name, c]));

  for (const [name, prodCol] of prodMap) {
    if (!localMap.has(name)) {
      console.log(`  DRIFT [${tableName}] '${name}' in production, NOT in MINIMAL_SCHEMA (prod: ${prodCol.data_type}, nullable=${prodCol.is_nullable})`);
      drifted = true;
    }
  }

  for (const [name, localCol] of localMap) {
    if (!prodMap.has(name)) {
      console.log(`  DRIFT [${tableName}] '${name}' in MINIMAL_SCHEMA, NOT in production (local: ${localCol.data_type})`);
      drifted = true;
    }
  }

  for (const [name, localCol] of localMap) {
    const prodCol = prodMap.get(name);
    if (!prodCol) continue;
    if (localCol.data_type !== prodCol.data_type) {
      console.log(`  DRIFT [${tableName}] '${name}' type: local=${localCol.data_type}, prod=${prodCol.data_type}`);
      drifted = true;
    }
    // Only check nullability for application_events (the table under test).
    // pbv_full_applications has intentionally relaxed NOT NULL in the harness.
    if (tableName === 'application_events' && localCol.is_nullable !== prodCol.is_nullable) {
      console.log(`  DRIFT [${tableName}] '${name}' nullable: local=${localCol.is_nullable}, prod=${prodCol.is_nullable}`);
      drifted = true;
    }
  }

  return drifted;
}

// --- Main ---------------------------------------------------------------------

const TABLES: readonly string[] = ['pbv_full_applications', 'application_events'];

async function main() {
  console.log('check-pbv-test-schema-drift');
  console.log('Comparing MINIMAL_SCHEMA against production for PBV tables only.');
  console.log('Stub tables (form_submissions, form_submission_documents, etc.) are NOT checked.');
  console.log('');

  let anyDrift = false;

  for (const table of TABLES) {
    console.log(`Checking ${table}...`);

    const localCols = parseSchemaColumns(MINIMAL_SCHEMA, table);
    let prodCols: ColInfo[];

    try {
      prodCols = await execSql<ColInfo>(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = '${table}'
         ORDER BY ordinal_position`
      );
    } catch (err) {
      console.error(`  ERROR querying production for ${table}:`, err);
      process.exit(1);
    }

    console.log(`  local:  ${localCols.length} columns`);
    console.log(`  prod:   ${prodCols.length} columns`);

    const drifted = compareColumns(table, localCols, prodCols);
    if (!drifted) {
      console.log(`  OK — no column drift`);
    } else {
      anyDrift = true;
    }
    console.log('');
  }

  if (anyDrift) {
    console.error('DRIFT DETECTED — update MINIMAL_SCHEMA in lib/__tests__/_db.ts to match production.');
    process.exit(1);
  } else {
    console.log('PASS — MINIMAL_SCHEMA matches production for all checked tables.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
