/**
 * PRD-76 #2 — tenant document upload race hardening (CRITICAL).
 *
 * The non-replace UPDATE has a `.eq('status','missing')` guard that makes the
 * second concurrent writer a no-op at the DB level. The pre-PRD-76 code
 * inspected only `updateError`, so the second writer proceeded to
 * `storage.upload(..., { upsert: false })`, which either silently 409'd or
 * orphaned an object while desyncing the row.
 *
 * The route is large (form parsing, HEIC conversion, event emission, storage
 * upload, rollback branch) so a functional test would mostly exercise mocks.
 * This test asserts the structural invariants of the route source — the same
 * pattern as `generate-forms-versioning.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const routePath = join(
  process.cwd(),
  'app',
  'api',
  't',
  '[token]',
  'pbv-full-app',
  'documents',
  '[doc_row_id]',
  'upload',
  'route.ts'
);
const source = readFileSync(routePath, 'utf8');

describe('PRD-76 #2 — upload supersede guard', () => {
  it('requests the affected-row count on the guarded UPDATE', () => {
    expect(source).toMatch(/\.update\(\s*updateData\s*,\s*\{\s*count:\s*['"]exact['"]\s*\}\s*\)/);
  });

  it('destructures count from the supabase response', () => {
    expect(source).toMatch(/count:\s*updatedCount/);
  });

  it('aborts to 409 upload_superseded when the non-replace UPDATE affected 0 rows', () => {
    expect(source).toMatch(/!isReplace\s*&&\s*\(updatedCount\s*\?\?\s*0\)\s*===\s*0/);
    expect(source).toMatch(/code:\s*['"]upload_superseded['"]/);
    expect(source).toMatch(/status:\s*409/);
  });

  it('logs the supersession with a warn so concurrent-upload races are observable', () => {
    expect(source).toMatch(/\[pbv-upload\] superseded/);
  });

  it('does NOT gate the replace path on affected-row count (replace legitimately updates a non-missing row)', () => {
    // The count check must be inside `!isReplace`.
    const guardSnippet = source.match(/if\s*\(!isReplace\s*&&\s*\(updatedCount\s*\?\?\s*0\)\s*===\s*0\)/);
    expect(guardSnippet).not.toBeNull();
  });

  it('places the abort BEFORE the storage upload block so no orphan storage object can be created', () => {
    const abortIdx = source.indexOf("code: 'upload_superseded'");
    const storageIdx = source.indexOf("supabaseAdmin.storage");
    expect(abortIdx).toBeGreaterThan(-1);
    expect(storageIdx).toBeGreaterThan(-1);
    expect(abortIdx).toBeLessThan(storageIdx);
  });
});
