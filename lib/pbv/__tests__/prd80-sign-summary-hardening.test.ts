/**
 * PRD-80 — Summary-signing ceremony hardening.
 *
 * A1: sign-summary mirrors PRD-64's getSession() assisted-by verification.
 * A5: sign-summary validates ceremony_id (UUID), language (enum), template_version.
 * A6: signature/capture validates signer_member_id + optional ceremony_id as UUIDs.
 *
 * The routes are wrapped in withTenantContext + supabaseAdmin chains, so a full
 * HTTP-level test would mostly exercise mock plumbing. These assertions inspect
 * the route source for structural invariants — the same pattern used by
 * sign-form-assisted-by-verify.test.ts (PRD-64).
 *
 * Pairs with the deferred runtime gates R1/R2 in the build report.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isUuid } from '../signing/validateSignFormBody';

const signSummarySrc = readFileSync(
  join(process.cwd(), 'app', 'api', 't', '[token]', 'pbv-full-app', 'sign-summary', 'route.ts'),
  'utf8'
);

const tenantCaptureSrc = readFileSync(
  join(
    process.cwd(),
    'app', 'api', 't', '[token]', 'pbv-full-app', 'signature', 'capture', 'route.ts'
  ),
  'utf8'
);

const memberCaptureSrc = readFileSync(
  join(
    process.cwd(),
    'app', 'api', 'pbv-full-app', 'signer', '[member_token]', 'signature', 'capture', 'route.ts'
  ),
  'utf8'
);

describe('PRD-80 A1 — sign-summary assisted-by getSession() verification', () => {
  it('imports getSession from @/lib/auth', () => {
    expect(signSummarySrc).toMatch(
      /import\s*\{[^}]*getSession[^}]*\}\s*from\s*['"]@\/lib\/auth['"]/
    );
  });

  it('no longer does an existence-only admin_users lookup after reading X-Assisted-By', () => {
    // The pre-PRD-80 block read the header then did
    //   supabaseAdmin.from('admin_users').select('id').eq('id', assistedByHeader)
    // — the new code uses getSession() instead. admin_users may appear
    // elsewhere in the file in unrelated code; it must NOT appear in the
    // X-Assisted-By verification block.
    const afterHeader = signSummarySrc.split('assistedByHeader')[1] ?? '';
    expect(afterHeader).not.toMatch(/from\(['"]admin_users['"]\)/);
  });

  it('reads session.assistedMode and verifies BOTH staffUserId and applicationId', () => {
    expect(signSummarySrc).toMatch(/getSession\(\)/);
    expect(signSummarySrc).toMatch(/session\.assistedMode/);
    expect(signSummarySrc).toMatch(/assistedMode\.staffUserId\s*===\s*assistedByHeader/);
    expect(signSummarySrc).toMatch(/assistedMode\.applicationId\s*===\s*app\.id/);
  });

  it('returns 401 assisted_session_unverified on mismatch (fail closed)', () => {
    expect(signSummarySrc).toMatch(/assisted_session_unverified/);
    expect(signSummarySrc).toMatch(/status\s*:\s*401/);
  });

  it('keeps the no-header self-signed path: assistedByStaffUserId defaults to null and is gated by `if (assistedByHeader)`', () => {
    expect(signSummarySrc).toMatch(/let\s+assistedByStaffUserId\s*:\s*string\s*\|\s*null\s*=\s*null/);
    expect(signSummarySrc).toMatch(/if\s*\(\s*assistedByHeader\s*\)/);
  });
});

describe('PRD-80 A5 — sign-summary input validation', () => {
  it('imports isUuid from validateSignFormBody (shares regex with PRD-77)', () => {
    expect(signSummarySrc).toMatch(
      /import\s*\{[^}]*isUuid[^}]*\}\s*from\s*['"]@\/lib\/pbv\/signing\/validateSignFormBody['"]/
    );
  });

  it('rejects non-UUID ceremony_id with a clean 400', () => {
    expect(signSummarySrc).toMatch(/!isUuid\(ceremony_id\)/);
    expect(signSummarySrc).toMatch(/ceremony_id must be a valid UUID/);
  });

  it('rejects language outside [en, es, pt] with a clean 400', () => {
    expect(signSummarySrc).toMatch(/SUMMARY_LANGUAGES/);
    expect(signSummarySrc).toMatch(/\['en',\s*'es',\s*'pt'\]/);
    expect(signSummarySrc).toMatch(/language must be one of en, es, pt/);
  });

  it('requires template_version to be a non-empty string', () => {
    expect(signSummarySrc).toMatch(/template_version must be a non-empty string/);
  });
});

describe('PRD-80 A6 — signature/capture UUID validation', () => {
  describe('tenant signature/capture route', () => {
    it('imports isUuid', () => {
      expect(tenantCaptureSrc).toMatch(
        /import\s*\{[^}]*isUuid[^}]*\}\s*from\s*['"]@\/lib\/pbv\/signing\/validateSignFormBody['"]/
      );
    });

    it('rejects non-UUID signer_member_id with 400', () => {
      expect(tenantCaptureSrc).toMatch(/!isUuid\(signer_member_id\)/);
      expect(tenantCaptureSrc).toMatch(/signer_member_id must be a valid UUID/);
    });

    it('rejects non-UUID ceremony_id when supplied (optional field)', () => {
      expect(tenantCaptureSrc).toMatch(/ceremony_id !== undefined && !isUuid\(ceremony_id\)/);
      expect(tenantCaptureSrc).toMatch(/ceremony_id must be a valid UUID/);
    });
  });

  describe('member-token signature/capture route', () => {
    it('imports isUuid', () => {
      expect(memberCaptureSrc).toMatch(
        /import\s*\{[^}]*isUuid[^}]*\}\s*from\s*['"]@\/lib\/pbv\/signing\/validateSignFormBody['"]/
      );
    });

    it('validates ceremony_id when supplied (signer_member_id is derived from the magic-link token, not from body)', () => {
      expect(memberCaptureSrc).toMatch(/ceremony_id !== undefined && !isUuid\(ceremony_id\)/);
      expect(memberCaptureSrc).toMatch(/ceremony_id must be a valid UUID/);
    });
  });
});

// Sanity: the shared isUuid primitive behaves as the routes expect.
describe('isUuid primitive used by all three routes', () => {
  it('accepts well-formed UUIDs', () => {
    expect(isUuid('8c4d5e2a-1f3b-4c91-8a99-f01234567890')).toBe(true);
    expect(isUuid('a1b2c3d4-e5f6-4a7b-9c8d-0123456789ab')).toBe(true);
  });

  it('rejects malformed strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null as any)).toBe(false);
    expect(isUuid(undefined as any)).toBe(false);
    expect(isUuid(123 as any)).toBe(false);
  });
});
