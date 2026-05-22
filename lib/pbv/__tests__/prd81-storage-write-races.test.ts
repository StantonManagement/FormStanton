/**
 * PRD-81 — Storage write-races round 2.
 *
 * A2: signatures POST uses DB-claim-first with optimistic lock; storage upload
 *     uses upsert:true; on storage failure the row is reverted.
 * A3: legacy /t/[token]/documents/[documentId] upload route gates the UPDATE
 *     on the read (status, revision); on race loss it removes the orphan
 *     storage object and returns 409 document_superseded.
 *
 * Both routes are wrapped in Supabase admin chains and large request handlers,
 * so the assertions inspect the route source for the structural invariants
 * (same pattern as PRD-64 / PRD-80 tests).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const signaturesSrc = readFileSync(
  join(
    process.cwd(),
    'app', 'api', 't', '[token]', 'pbv-full-app', 'signatures', 'route.ts'
  ),
  'utf8'
);

const legacyDocSrc = readFileSync(
  join(
    process.cwd(),
    'app', 'api', 't', '[token]', 'documents', '[documentId]', 'route.ts'
  ),
  'utf8'
);

describe('PRD-81 A2 — signatures POST DB-claim-first', () => {
  it('reads storage_path/file_name into the doc lookup (needed for rollback)', () => {
    expect(signaturesSrc).toMatch(/select\([^)]*storage_path[^)]*\)/);
    expect(signaturesSrc).toMatch(/select\([^)]*file_name[^)]*\)/);
  });

  it('captures prior status/revision/path before the claim', () => {
    expect(signaturesSrc).toMatch(/const\s+priorStatus\s*=/);
    expect(signaturesSrc).toMatch(/const\s+priorRevision\s*=/);
    expect(signaturesSrc).toMatch(/const\s+priorStoragePath\s*=/);
    expect(signaturesSrc).toMatch(/const\s+priorFileName\s*=/);
  });

  it('UPDATE precedes the storage upload (DB-claim-first ordering)', () => {
    // Match across line-ending variants (CRLF/LF) and whitespace.
    const updateMatch = signaturesSrc.match(
      /from\(['"]application_documents['"]\)\s*\n?\s*\.update\(\s*\{[\s\S]*?status:\s*['"]submitted['"]/
    );
    const uploadMatch = signaturesSrc.match(
      /from\(['"]pbv-applications['"]\)\s*\n?\s*\.upload\(storagePath,\s*buffer/
    );
    expect(updateMatch).not.toBeNull();
    expect(uploadMatch).not.toBeNull();
    expect(updateMatch!.index!).toBeLessThan(uploadMatch!.index!);
  });

  it('claim UPDATE carries an optimistic lock on the read (status, revision) and selects affected rows', () => {
    expect(signaturesSrc).toMatch(/\.eq\(['"]status['"],\s*priorStatus\)/);
    expect(signaturesSrc).toMatch(/\.eq\(['"]revision['"],\s*priorRevision\)/);
    expect(signaturesSrc).toMatch(/claimedRows/);
    expect(signaturesSrc).toMatch(/claimedRows\?\.length\s*\?\?\s*0\)\s*===\s*0/);
  });

  it('race-lost branch skips cleanly without a storage write (no orphan)', () => {
    expect(signaturesSrc).toMatch(/pbv_signatures_race_lost/);
    // The continue must follow the race-lost log, not a throw.
    const after = signaturesSrc.split('pbv_signatures_race_lost')[1] ?? '';
    expect(after.slice(0, 200)).toMatch(/continue/);
  });

  it('storage upload now uses upsert:true (idempotent for identical bytes)', () => {
    // Search the upload call specifically (avoid matching unrelated upsert flags).
    expect(signaturesSrc).toMatch(
      /upload\(storagePath,\s*buffer,\s*\{\s*contentType:\s*['"]image\/png['"],\s*upsert:\s*true\s*\}\)/
    );
  });

  it('storage failure rolls the row back to its prior values', () => {
    // The rollback must reset status, revision, file_name, storage_path to
    // the captured prior* values and re-throw the upload error.
    expect(signaturesSrc).toMatch(/status:\s*priorStatus/);
    expect(signaturesSrc).toMatch(/revision:\s*priorRevision/);
    expect(signaturesSrc).toMatch(/file_name:\s*priorFileName/);
    expect(signaturesSrc).toMatch(/storage_path:\s*priorStoragePath/);
    expect(signaturesSrc).toMatch(/throw uploadError/);
  });
});

describe('PRD-81 A3 — legacy document upload affected-row guard + orphan cleanup', () => {
  it('UPDATE selects affected rows for a count check', () => {
    expect(legacyDocSrc).toMatch(/updatedRows/);
    expect(legacyDocSrc).toMatch(/\.select\(['"]id['"]\)/);
  });

  it('UPDATE carries an optimistic lock on the read (status, revision)', () => {
    expect(legacyDocSrc).toMatch(/\.eq\(['"]status['"],\s*doc\.status\)/);
    expect(legacyDocSrc).toMatch(/\.eq\(['"]revision['"],\s*doc\.revision\s*\?\?\s*0\)/);
  });

  it('on 0 rows affected, removes the orphan storage object and returns 409 document_superseded', () => {
    expect(legacyDocSrc).toMatch(/updatedRows\?\.length\s*\?\?\s*0\)\s*===\s*0/);
    expect(legacyDocSrc).toMatch(/\.remove\(\[storagePath\]\)/);
    expect(legacyDocSrc).toMatch(/document_superseded/);
    expect(legacyDocSrc).toMatch(/status:\s*409/);
  });

  it('on remove failure during orphan cleanup, logs and still returns 409 (does not throw)', () => {
    expect(legacyDocSrc).toMatch(/tenant_document_orphan_remove_failed/);
    // The orphan-remove warn lives between the remove call and the 409
    // return; the route must not throw out of the orphan-cleanup branch.
    const branch = legacyDocSrc.split('tenant_document_orphan_remove_failed')[1] ?? '';
    expect(branch).toMatch(/return NextResponse\.json/);
    expect(branch.split('return NextResponse.json')[0]).not.toMatch(/throw/);
  });

  it('happy path (rows affected) returns 201 with file_name / revision (unchanged behavior)', () => {
    expect(legacyDocSrc).toMatch(/status:\s*201/);
    expect(legacyDocSrc).toMatch(/file_name:\s*fileName/);
  });
});
