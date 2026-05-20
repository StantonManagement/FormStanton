/**
 * lib/pbv/__tests__/form-templates-seed.test.ts
 *
 * Verifies that the pbv_form_templates migration SQL contains exactly 17 rows,
 * 13 with generation_enabled=TRUE and 4 with generation_enabled=FALSE.
 * This is a static analysis test — parses the migration SQL file without hitting the DB.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '../../../supabase/migrations/20260515040000_pbv_form_templates.sql'
);

describe('pbv_form_templates migration seed', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('contains exactly 17 form_id inserts', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const formIdMatches = sql.match(/'\w+',\s*\n\s*'[^']+',\s*\n\s*'[^']+',\s*\n\s*(TRUE|FALSE)/g);
    expect(formIdMatches?.length).toBe(17);
  });

  it('has 13 generation_enabled=TRUE rows', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const trueMatches = sql.match(/TRUE, '(sourced|verified)'/g);
    expect(trueMatches?.length).toBe(13);
  });

  it('has 4 generation_enabled=FALSE rows', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const falseMatches = sql.match(/FALSE, 'pending'/g);
    expect(falseMatches?.length).toBe(4);
  });

  it('zero_income_statement has generation_enabled=FALSE', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    const zeroIncomeIdx = sql.indexOf("'zero_income_statement'");
    expect(zeroIncomeIdx).toBeGreaterThan(-1);
    const segment = sql.slice(zeroIncomeIdx, zeroIncomeIdx + 300);
    expect(segment).toContain('FALSE');
    expect(segment).not.toContain('TRUE');
  });
});
