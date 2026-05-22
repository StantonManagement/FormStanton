/**
 * PRD-83 — Concurrency & clock correctness.
 *
 * A7: lib/idempotency.ts expiry comparison uses epoch-ms (.getTime()/Date.now()).
 * A10: send-link UPDATE optimistic-locks on the read token; race-loss re-reads
 *      and returns the winning token with `race:true`.
 * A11: generate-forms summary PDF path carries SUMMARY_TEMPLATE_VERSION and is
 *      written upsert:false; 409 is treated as a benign replay.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const idempotencySrc = readFileSync(
  join(process.cwd(), 'lib', 'idempotency.ts'),
  'utf8'
);
const sendLinkSrc = readFileSync(
  join(
    process.cwd(),
    'app', 'api', 't', '[token]', 'pbv-full-app', 'additional-signers',
    '[member_id]', 'send-link', 'route.ts'
  ),
  'utf8'
);
const generateFormsSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 't', '[token]', 'pbv-full-app', 'generate-forms', 'route.ts'),
  'utf8'
);

describe('PRD-83 A7 — withIdempotency epoch-ms expiry comparison', () => {
  it('uses Date.now() and getTime() (not the pre-PRD-83 Date>Date comparison)', () => {
    expect(idempotencySrc).toMatch(
      /new Date\(existing\.expires_at\)\.getTime\(\)\s*>\s*Date\.now\(\)/
    );
  });

  it('preserves the cache-hit return shape (response_body + response_status)', () => {
    expect(idempotencySrc).toMatch(
      /NextResponse\.json\(existing\.response_body,\s*\{\s*status:\s*existing\.response_status\s*\}\)/
    );
  });

  it('no longer compares two local Date instances directly', () => {
    expect(idempotencySrc).not.toMatch(
      /new Date\(existing\.expires_at\)\s*>\s*new Date\(\)\s*\)/
    );
  });

  it('does not change other behavior in the file (upsert still writes the cached response)', () => {
    expect(idempotencySrc).toMatch(/tenant_idempotency_keys/);
    expect(idempotencySrc).toMatch(/\.upsert\(\{/);
  });
});

describe('PRD-83 A10 — send-link optimistic-lock on token regen', () => {
  it('UPDATE is scoped by the token value we read (optimistic lock)', () => {
    expect(sendLinkSrc).toMatch(
      /\.eq\(['"]magic_link_token['"],\s*member\.magic_link_token\s*\?\?\s*['"]['"]\)/
    );
  });

  it('UPDATE selects affected rows for race detection', () => {
    expect(sendLinkSrc).toMatch(/updateRows/);
    expect(sendLinkSrc).toMatch(/\.select\(['"]id['"]\)/);
    expect(sendLinkSrc).toMatch(/updateRows\?\.length\s*\?\?\s*0\)\s*===\s*0/);
  });

  it('race-loss branch re-reads and returns the winning token with race:true', () => {
    // Re-read should fetch the current token after losing the race.
    expect(sendLinkSrc).toMatch(
      /\.select\(['"]magic_link_token,\s*magic_link_expires_at['"]\)/
    );
    expect(sendLinkSrc).toMatch(/race:\s*true/);
    expect(sendLinkSrc).toMatch(/regenerated:\s*false/);
  });

  it('happy path still returns regenerated:true with the new token', () => {
    // The happy-path return is after the race-loss branch; just check both
    // truthy `regenerated:true` and the new token round-trip exist.
    expect(sendLinkSrc).toMatch(/regenerated:\s*true/);
    expect(sendLinkSrc).toMatch(/magic_link_token:\s*newToken/);
  });
});

describe('PRD-83 A11 — generate-forms summary upload anti-clobber', () => {
  it('summary path carries SUMMARY_TEMPLATE_VERSION', () => {
    expect(generateFormsSrc).toMatch(
      /summary-\$\{summaryLang\}-v\$\{SUMMARY_TEMPLATE_VERSION\}-unsigned\.pdf/
    );
  });

  it('summary upload now uses upsert:false', () => {
    // The summary upload region — must NOT carry upsert:true anywhere near the
    // summary-${summaryLang} path. Easiest check: the summaryStoragePath line
    // is followed by an upload with `upsert: false`.
    const region = generateFormsSrc.split('summaryStoragePath =')[1] ?? '';
    expect(region).toMatch(/upsert:\s*false/);
    // And does not contain the pre-PRD-83 `upsert: true` for THIS upload.
    const summaryUploadBlock = region.split('summaryUploadError')[0];
    expect(summaryUploadBlock).not.toMatch(/upsert:\s*true/);
  });

  it('benign 409 / "exists" / "duplicate" replay does not throw', () => {
    expect(generateFormsSrc).toMatch(/benignReplay/);
    expect(generateFormsSrc).toMatch(/generate_forms_summary_benign_replay/);
    // The summary upload's only `throw summaryUploadError;` lives inside
    // the `if (!benignReplay)` guard — i.e. the benign branch falls
    // through without throwing.
    expect(generateFormsSrc).toMatch(
      /if\s*\(\s*!benignReplay\s*\)\s*\{\s*throw\s+summaryUploadError;\s*\}/
    );
    // And the only `throw summaryUploadError` token is inside that guard
    // (no other unguarded throw of the same error).
    const throws = generateFormsSrc.match(/throw\s+summaryUploadError/g) ?? [];
    expect(throws.length).toBe(1);
  });

  it('does NOT touch the PRD-76 form-document generation region (upsertOnUpload, generationVersion)', () => {
    // Sanity: PRD-76's first-gen race fix lives in the SAME file. PRD-83
    // must only edit the summary region.
    expect(generateFormsSrc).toMatch(/generationVersion/);
    expect(generateFormsSrc).toMatch(/upsertOnUpload/);
    expect(generateFormsSrc).toMatch(/benignFirstGenCollision/);
  });
});
