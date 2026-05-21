/**
 * PRD-64 (audit #4): HOH sign-form route verifies X-Assisted-By against the
 * active staff session, not against admin_users existence.
 *
 * The route is wrapped in withTenantContext + withIdempotency + multiple
 * supabaseAdmin chains, so a full HTTP-level test is heavy and would mostly
 * exercise mock plumbing. This test asserts the structural invariants of the
 * route source — the same approach as lib/pbv/__tests__/sign-form-unification.test.ts.
 *
 * Pairs with the deferred runtime gate R2 in the build report, which walks the
 * real staff-assisted ceremony on a deploy.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const routePath = join(
  process.cwd(),
  'app', 'api', 't', '[token]', 'pbv-full-app', 'sign-form', 'route.ts'
);
const source = readFileSync(routePath, 'utf8');

describe('HOH sign-form — PRD-64 X-Assisted-By session verification', () => {
  it('imports getSession from @/lib/auth', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*getSession[^}]*\}\s*from\s*['"]@\/lib\/auth['"]/
    );
  });

  it('uses getSession() to read session.assistedMode (no more existence-only admin_users lookup for X-Assisted-By)', () => {
    expect(source).toMatch(/getSession\(\)/);
    expect(source).toMatch(/session\.assistedMode/);
    // The old existence-only lookup is gone — admin_users may still appear
    // in unrelated code paths, but it must NOT appear immediately after
    // reading the X-Assisted-By header.
    const block = source.split('assistedByHeader')[1] ?? '';
    expect(block).not.toMatch(/from\(['"]admin_users['"]\)/);
  });

  it('verifies BOTH staffUserId and applicationId match', () => {
    expect(source).toMatch(/assistedMode\.staffUserId\s*===\s*assistedByHeader/);
    expect(source).toMatch(/assistedMode\.applicationId\s*===\s*app\.id/);
  });

  it('returns 401 assisted_session_unverified when present-but-unverified (fail closed)', () => {
    expect(source).toMatch(/assisted_session_unverified/);
    expect(source).toMatch(/status\s*:\s*401/);
    expect(source).toMatch(/assisted_by_unverified/);
  });

  it('still lets a request through with NO X-Assisted-By header (self path unchanged)', () => {
    // The verification block is gated on `if (assistedByHeader) { ... }` so
    // assistedByStaffUserId stays null when the header is absent.
    expect(source).toMatch(/if\s*\(\s*assistedByHeader\s*\)/);
    expect(source).toMatch(/let\s+assistedByStaffUserId\s*:\s*string\s*\|\s*null\s*=\s*null/);
  });
});
