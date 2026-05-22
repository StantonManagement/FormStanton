/**
 * PRD-78 #6 + #8 — magic-link signer routes use the shared expiry helper and
 * (sign-form only) the shared body validator.
 *
 * Structural-invariant pattern; both routes are wrapped in heavy supabase
 * chains (no withTenantContext — magic-link auth).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const bootstrapPath = join(
  process.cwd(),
  'app',
  'api',
  'pbv-full-app',
  'signer',
  '[member_token]',
  'route.ts'
);
const signFormPath = join(
  process.cwd(),
  'app',
  'api',
  'pbv-full-app',
  'signer',
  '[member_token]',
  'sign-form',
  'route.ts'
);

const bootstrap = readFileSync(bootstrapPath, 'utf8');
const signForm = readFileSync(signFormPath, 'utf8');

describe('PRD-78 #8 — signer bootstrap GET uses shared expiry helper', () => {
  it('imports isMagicLinkExpired from @/lib/pbv/magicLinkExpiry', () => {
    expect(bootstrap).toMatch(
      /import\s*\{\s*isMagicLinkExpired\s*\}\s*from\s*['"]@\/lib\/pbv\/magicLinkExpiry['"]/
    );
  });

  it('calls isMagicLinkExpired(member.magic_link_expires_at) for the 410 gate', () => {
    expect(bootstrap).toMatch(
      /isMagicLinkExpired\(\s*member\.magic_link_expires_at\s*\)/
    );
  });

  it('no longer constructs a local `new Date()` for the expiry comparison', () => {
    // The inline `const now = new Date()` and `new Date(member.magic_link_expires_at) < now`
    // patterns must be gone.
    expect(bootstrap).not.toMatch(/new Date\(member\.magic_link_expires_at\)\s*<\s*now/);
    expect(bootstrap).not.toMatch(/const\s+now\s*=\s*new\s+Date\(\)/);
  });

  it('returns 410 with code: "expired" when the helper says expired', () => {
    expect(bootstrap).toMatch(/code:\s*['"]expired['"]/);
    expect(bootstrap).toMatch(/status:\s*410/);
  });
});

describe('PRD-78 #8 — signer sign-form POST uses shared expiry helper', () => {
  it('imports isMagicLinkExpired from @/lib/pbv/magicLinkExpiry', () => {
    expect(signForm).toMatch(
      /import\s*\{\s*isMagicLinkExpired\s*\}\s*from\s*['"]@\/lib\/pbv\/magicLinkExpiry['"]/
    );
  });

  it('calls isMagicLinkExpired(member.magic_link_expires_at) for the 410 gate', () => {
    expect(signForm).toMatch(
      /isMagicLinkExpired\(\s*member\.magic_link_expires_at\s*\)/
    );
  });

  it('no longer constructs a local new Date() for the expiry comparison', () => {
    expect(signForm).not.toMatch(/new Date\(member\.magic_link_expires_at\)\s*<\s*new Date\(\)/);
  });
});

describe('PRD-78 #6 — signer sign-form POST applies the shared body validator', () => {
  it('imports validateSignFormBody from @/lib/pbv/signing/validateSignFormBody (created in PRD-77)', () => {
    expect(signForm).toMatch(
      /import\s*\{\s*validateSignFormBody\s*\}\s*from\s*['"]@\/lib\/pbv\/signing\/validateSignFormBody['"]/
    );
  });

  it('calls validateSignFormBody with requireSignerMemberId: false (member derived from token)', () => {
    expect(signForm).toMatch(
      /validateSignFormBody\(\s*body\s*,\s*\{\s*requireSignerMemberId\s*:\s*false\s*\}\s*\)/
    );
  });

  it('returns 400 with the helper-provided message on validation failure', () => {
    const idx = signForm.indexOf('validation.ok');
    expect(idx).toBeGreaterThan(-1);
    const window = signForm.slice(idx, idx + 500);
    expect(window).toMatch(/status:\s*400/);
    expect(window).toMatch(/validation\.message/);
  });

  it('removes the old presence-only inline check (the old "..., ceremony_id required" string)', () => {
    expect(signForm).not.toMatch(
      /form_document_id, typed_name, signature_image_path, ceremony_id required/
    );
  });

  it('runs body validation AFTER the 410 expiry check (per PRD goal: link validity first)', () => {
    const expiryIdx = signForm.indexOf('isMagicLinkExpired');
    const validateIdx = signForm.indexOf('validateSignFormBody(body');
    expect(expiryIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeGreaterThan(-1);
    expect(expiryIdx).toBeLessThan(validateIdx);
  });
});
