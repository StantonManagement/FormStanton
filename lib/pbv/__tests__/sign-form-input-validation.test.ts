/**
 * PRD-77 #6 (tenant route) — sign-form delegates body validation to the
 * shared validator and returns 400 before any DB work.
 *
 * Structural-invariant pattern on the route source (the file is large and
 * wrapped in withTenantContext + withIdempotency + supabase chains, so a
 * full HTTP test would mostly be mock plumbing).
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
  'sign-form',
  'route.ts'
);
const source = readFileSync(routePath, 'utf8');

describe('HOH sign-form — PRD-77 #6 input validation', () => {
  it('imports validateSignFormBody from @/lib/pbv/signing/validateSignFormBody', () => {
    expect(source).toMatch(
      /import\s*\{\s*validateSignFormBody\s*\}\s*from\s*['"]@\/lib\/pbv\/signing\/validateSignFormBody['"]/
    );
  });

  it('calls validateSignFormBody with requireSignerMemberId: true (HOH path)', () => {
    expect(source).toMatch(
      /validateSignFormBody\(\s*body\s*,\s*\{\s*requireSignerMemberId\s*:\s*true\s*\}\s*\)/
    );
  });

  it('returns 400 on validation failure with the helper-provided message', () => {
    // The validation failure branch returns NextResponse.json({ success:false, message: validation.message }, { status: 400 })
    const idx = source.indexOf('validation.ok');
    expect(idx).toBeGreaterThan(-1);
    const window = source.slice(idx, idx + 500);
    expect(window).toMatch(/status:\s*400/);
    expect(window).toMatch(/validation\.message/);
  });

  it('removes the old presence-only inline check (no more "form_document_id, signer_member_id, typed_name, signature_image_path, and ceremony_id are required" string)', () => {
    expect(source).not.toMatch(
      /form_document_id, signer_member_id, typed_name, signature_image_path, and ceremony_id are required/
    );
  });

  it('places the 400 BEFORE the withTenantContext CALL so invalid bodies do not trigger a DB lookup', () => {
    // The CALL is `return withTenantContext(request, ...)`. The import line
    // above does not match.
    const validateIdx = source.indexOf('validateSignFormBody(body');
    const callIdx = source.indexOf('return withTenantContext');
    expect(validateIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeGreaterThan(-1);
    expect(validateIdx).toBeLessThan(callIdx);
  });
});
