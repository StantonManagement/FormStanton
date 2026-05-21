/**
 * PRD-76 #4 — first-generation race hardening (HIGH).
 *
 * PRD-66 closed the >=1 signer case (bump + upsert:false). The remaining
 * exposure: two concurrent first-gen requests both read existingVersion=null,
 * both pick v1, and with upsert:true the second silently overwrites the
 * first's bytes — a signer who already hashed the first PDF would mismatch
 * the stored bytes at finalize Check 5.
 *
 * Hardening (collision-detect path, the PRD's documented fallback default
 * when an RPC advisory-lock cannot be validated in-session): use upsert:false
 * on the first-gen path; on a "exists" / "409" / "duplicate" storage error,
 * re-read the winning row and reuse it without re-upserting (preserving the
 * winner's hash → bytes consistency).
 *
 * Structural-invariant tests on the route source, same shape as
 * `generate-forms-versioning.test.ts`.
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
  'generate-forms',
  'route.ts'
);
const source = readFileSync(routePath, 'utf8');

describe('PRD-76 #4 — first-generation race hardening', () => {
  it('uses upsert:false on the first-gen path (existingVersion === null)', () => {
    // The first-gen branch must NOT set upsertOnUpload = true.
    const firstGenBranch = source.match(
      /if\s*\(\s*existingVersion\s*===\s*null\s*\)\s*\{\s*generationVersion\s*=\s*1;\s*upsertOnUpload\s*=\s*(false|true)/
    );
    expect(firstGenBranch).not.toBeNull();
    expect(firstGenBranch![1]).toBe('false');
  });

  it('detects benign first-gen collisions via 409 / "exist" / "duplicate" on the storage error', () => {
    expect(source).toMatch(/benignFirstGenCollision/);
    expect(source).toMatch(/status\s*===\s*['"]409['"]/);
    expect(source).toMatch(/msg\.includes\(\s*['"]exist['"]\s*\)/);
    expect(source).toMatch(/msg\.includes\(\s*['"]duplicate['"]\s*\)/);
  });

  it('gates the collision branch on existingVersion === null (only the first-gen race is benign)', () => {
    expect(source).toMatch(
      /benignFirstGenCollision\s*=\s*[\s\S]*existingVersion\s*===\s*null/
    );
  });

  function extractCollisionBranch(): string {
    // Body of the `if (benignFirstGenCollision) { ... }` block.
    const ifIdx = source.indexOf('if (benignFirstGenCollision)');
    expect(ifIdx).toBeGreaterThan(-1);
    // Find the matching closing brace via a simple depth walk.
    const open = source.indexOf('{', ifIdx);
    let depth = 1;
    let i = open + 1;
    while (i < source.length && depth > 0) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    return source.slice(open + 1, i - 1);
  }

  it('re-reads the winning row on collision and pushes it to the generated list', () => {
    const body = extractCollisionBranch();
    expect(body).toMatch(/\.from\(\s*['"]pbv_form_documents['"]\s*\)/);
    expect(body).toMatch(/winnerRow/);
    expect(body).toMatch(/generated\.push/);
  });

  it('skips the upsert in the collision branch (preserves the winner row’s hash → bytes consistency)', () => {
    const body = extractCollisionBranch();
    // The collision branch must terminate the current iteration before the
    // upsert below — either with `continue` or with the loop-aware
    // `break` for the isPerPersonAllAdults case.
    expect(body).toMatch(/continue;/);
    // And critically must NOT contain `.upsert(` (no row write).
    expect(body).not.toMatch(/\.upsert\(/);
  });

  it('still preserves PRD-66 multi-signer behavior (>=1 signer → bump + upsert:false)', () => {
    expect(source).toMatch(/generationVersion\s*=\s*existingVersion\s*\+\s*1;/);
  });

  it('still preserves PRD-66 zero-signer reuse behavior (existing row, 0 signers → reuse + upsert:true)', () => {
    expect(source).toMatch(/collectedSignerCount\s*===\s*0[\s\S]*generationVersion\s*=\s*existingVersion;\s*upsertOnUpload\s*=\s*true/);
  });
});
