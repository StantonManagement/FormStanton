/**
 * PRD-77 #5 — withTenantContext centrally gates `packet_locked`.
 *
 * Structural-invariant test on the helper source — the live behavior requires
 * supabase + iron-session, which the rest of this test suite mocks file-by-
 * file. The structural shape (a) always selects packet_locked regardless of
 * caller select, (b) ordering: 404 → submitted_locked 409 → packet_locked
 * 409 → handler, (c) returns code: 'packet_locked' with 409.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const sourcePath = join(process.cwd(), 'lib', 'pbv', 'tenantEndpoint.ts');
const source = readFileSync(sourcePath, 'utf8');

describe('withTenantContext — PRD-77 #5 packet_locked centralization', () => {
  it('TenantApp interface includes packet_locked', () => {
    expect(source).toMatch(/packet_locked\?:\s*boolean\s*\|\s*null/);
  });

  it('always appends packet_locked to the caller-supplied select (cannot be bypassed by a forgotten column)', () => {
    expect(source).toMatch(/ensurePacketLockedSelected/);
    // The helper must dedupe (no double-select if already present) and append.
    expect(source).toMatch(/includes\(\s*['"]packet_locked['"]\s*\)/);
  });

  it('uses the augmented select when calling supabase', () => {
    // The call to resolveTokenToApp must pass the result of
    // ensurePacketLockedSelected through to supabase.select(...).
    expect(source).toMatch(/ensurePacketLockedSelected\(select\)/);
    expect(source).toMatch(/\.select\(effectiveSelect\)/);
  });

  it('returns 409 packet_locked AFTER the submitted_locked check (correct precedence)', () => {
    const submittedIdx = source.indexOf("code: 'submitted_locked'");
    const packetIdx = source.indexOf("code: 'packet_locked'");
    expect(submittedIdx).toBeGreaterThan(-1);
    expect(packetIdx).toBeGreaterThan(-1);
    expect(submittedIdx).toBeLessThan(packetIdx);
  });

  it('packet_locked gate uses status 409 (matches submitted_locked pattern)', () => {
    // Look at the body around code: 'packet_locked' for the status line.
    const idx = source.indexOf("code: 'packet_locked'");
    const window = source.slice(idx, idx + 250);
    expect(window).toMatch(/status:\s*409/);
  });

  it('packet_locked gate fires BEFORE the withIdempotency CALL (handler is never invoked)', () => {
    const packetIdx = source.indexOf("code: 'packet_locked'");
    // The CALL site is `return withIdempotency(request, ...)`; the import
    // line above does not match `return withIdempotency`.
    const callIdx = source.indexOf('return withIdempotency');
    expect(packetIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeGreaterThan(-1);
    expect(packetIdx).toBeLessThan(callIdx);
  });

  it('still falls through to handler when packet_locked is false / null / undefined', () => {
    // The gate is wrapped in `if (app.packet_locked) { ... }` — truthy check,
    // so null/undefined/false all pass through.
    expect(source).toMatch(/if\s*\(\s*app\.packet_locked\s*\)/);
  });
});
