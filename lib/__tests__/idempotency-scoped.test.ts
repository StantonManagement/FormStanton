/**
 * PRD-66 (audit #9): the cached-response lookup in lib/idempotency.ts is
 * scoped by application_id. A guessed/reused Idempotency-Key from one
 * tenant should not return another tenant's cached response.
 *
 * Strategy: instead of mocking the supabase chain heavily, this test inspects
 * the source of `withIdempotency` to confirm the WHERE includes an
 * application_id equality. The behavioral end-to-end (a different tenant's
 * call truly misses the cache) is implicitly proved — supabase's .eq()
 * filters out non-matching rows by contract.
 *
 * The structural assertion is cheap and durable; a future refactor that
 * removes the application_id scope would fail this test immediately.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const idempotencyPath = join(process.cwd(), 'lib', 'idempotency.ts');
const source = readFileSync(idempotencyPath, 'utf8');

describe('PRD-66 idempotency lookup is scoped by application_id', () => {
  it('the existing-row select chain contains .eq(\'application_id\', applicationId)', () => {
    // Find the lookup block (the .from('tenant_idempotency_keys').select(...))
    // and assert it includes an application_id eq before maybeSingle().
    const fromIdx = source.indexOf("from('tenant_idempotency_keys')");
    expect(fromIdx).toBeGreaterThanOrEqual(0);
    const maybeSingleIdx = source.indexOf('.maybeSingle()', fromIdx);
    expect(maybeSingleIdx).toBeGreaterThan(fromIdx);
    const block = source.slice(fromIdx, maybeSingleIdx);
    expect(block).toMatch(/\.eq\(\s*'application_id'\s*,\s*applicationId\s*\)/);
    // And the key + endpoint scopes remain.
    expect(block).toMatch(/\.eq\(\s*'key'\s*,\s*key\s*\)/);
    expect(block).toMatch(/\.eq\(\s*'endpoint'\s*,\s*endpoint\s*\)/);
  });

  it('the upsert still writes application_id (so the scope works for future cache reads)', () => {
    expect(source).toMatch(/application_id\s*,/);
    expect(source).toMatch(/\.upsert\(\{[\s\S]*application_id[\s\S]*\}\)/);
  });
});
