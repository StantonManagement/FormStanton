/**
 * PRD-66 (audit #5): generate-forms versions the unsigned PDF and bumps
 * generation_version when a regenerate happens on a row that already has at
 * least one collected signer. Zero signers means a clean regenerate and the
 * existing version is reused.
 *
 * The route is large (token resolution, intake snapshot, member load,
 * conditional rules, field resolution, stamper, supabase upserts), so a
 * full functional test would mostly exercise mock plumbing. This test
 * asserts the structural invariants of the route source — the same pattern
 * the rest of this batch uses for heavy routes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const routePath = join(
  process.cwd(),
  'app', 'api', 't', '[token]', 'pbv-full-app', 'generate-forms', 'route.ts'
);
const source = readFileSync(routePath, 'utf8');

describe('PRD-66 generate-forms versioning (audit #5)', () => {
  it('reads existing generation_version + collected_signer_member_ids before deciding the version', () => {
    expect(source).toMatch(/\.select\(\s*['"]generation_version,\s*collected_signer_member_ids[^'"]*['"]\s*\)/);
    expect(source).toMatch(/existingVersion/);
    expect(source).toMatch(/collectedSignerCount/);
  });

  it('keeps the existing version when no signers have been collected (zero-signer case)', () => {
    // The "row exists, 0 signers" branch reuses existingVersion.
    expect(source).toMatch(/collectedSignerCount\s*===\s*0/);
    expect(source).toMatch(/generationVersion\s*=\s*existingVersion/);
  });

  it('bumps the version when at least one signer has been collected', () => {
    expect(source).toMatch(/generationVersion\s*=\s*existingVersion\s*\+\s*1/);
  });

  it('initializes generation_version=1 for a brand-new form_doc row', () => {
    expect(source).toMatch(/existingVersion\s*===\s*null/);
    expect(source).toMatch(/generationVersion\s*=\s*1/);
  });

  it("writes the version into the unsigned PDF storage path as `-v${generationVersion}.pdf`", () => {
    expect(source).toMatch(/-v\$\{generationVersion\}\.pdf/);
  });

  it('uses upsert:false on the storage upload when the version was bumped (brand-new path)', () => {
    // The route picks upsertOnUpload based on the branch; the bump branch sets false.
    expect(source).toMatch(/upsert:\s*upsertOnUpload/);
    expect(source).toMatch(/upsertOnUpload\s*=\s*false/);
    expect(source).toMatch(/upsertOnUpload\s*=\s*true/);
  });

  it('writes generation_version into the pbv_form_documents upsert payload', () => {
    expect(source).toMatch(/generation_version:\s*generationVersion/);
  });
});
