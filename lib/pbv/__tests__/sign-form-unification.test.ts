/**
 * PRD-62 Gate 1: HOH sign-form route now delegates to lib/pbv/signing/completeFormSigning
 * — no route-local signing reimplementation.
 *
 * The route is wrapped in withTenantContext + an idempotency key, which makes a
 * full HTTP-level integration test heavy. Instead, this test enforces the
 * structural invariant: the route source no longer contains its own field-map
 * loader, signature-field builder, or @deprecated dead helper, and it does
 * import the shared signing function.
 *
 * (Lives under lib/pbv/__tests__ because vitest.config only includes
 *  lib/** and components/**. The path it reads still points at the route
 *  source under app/.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const routePath = join(process.cwd(), 'app', 'api', 't', '[token]', 'pbv-full-app', 'sign-form', 'route.ts');
const source = readFileSync(routePath, 'utf8');

describe('HOH sign-form route — PRD-62 unification', () => {
  it('imports completeFormSigning from the shared signing module', () => {
    expect(source).toMatch(
      /import\s*\{[^}]*completeFormSigning[^}]*\}\s*from\s*['"]@\/lib\/pbv\/signing\/completeForm['"]/
    );
  });

  it('calls completeFormSigning with typedName + ipAddress/userAgent (no fake Request)', () => {
    expect(source).toMatch(/completeFormSigning\s*\(/);
    expect(source).toMatch(/typedName\s*:/);
    expect(source).toMatch(/ipAddress\s*[:,]/);
    expect(source).toMatch(/userAgent\s*[:,]/);
  });

  it('no longer defines route-local signing helpers', () => {
    expect(source).not.toMatch(/buildSignatureFieldDataF5/);
    expect(source).not.toMatch(/@deprecated\s+Use\s+buildSignatureFieldDataF5/);
    expect(source).not.toMatch(/function\s+loadFieldMapForSigning/);
    // The route should no longer pull stampForm or FieldMap directly.
    expect(source).not.toMatch(/from\s+['"]@\/lib\/pbv\/form-generation\/stamper['"]/);
  });

  it('preserves the HOH-only summary-doc-signed gate', () => {
    expect(source).toMatch(/summary_not_signed/);
    expect(source).toMatch(/pbv_summary_documents/);
  });
});
