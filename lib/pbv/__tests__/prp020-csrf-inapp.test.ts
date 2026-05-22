/**
 * PRP-020 / D7 + F3 — CSRF token issuance/verification + in-app browser
 * detection.
 *
 * CSRF: pure-unit tests on issueCsrfToken / verifyCsrfToken using the
 *   default fallback secret. The full withTenantContext integration
 *   (header verify -> warn log) is covered by source-grep + a runtime
 *   gate.
 * F3:  pure-unit tests on isInAppBrowser.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// supabaseAdmin is loaded transitively; stub before importing.
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: () => ({}) },
}));

import { issueCsrfToken, verifyCsrfToken } from '@/lib/pbv/tenantEndpoint';
import { isInAppBrowser } from '@/components/pbv/sign/MagicLinkSigningFlow';

describe('PRP-020 / D7 — CSRF token round-trip', () => {
  it('issued token verifies against the same appId', () => {
    const tok = issueCsrfToken('app-1');
    expect(verifyCsrfToken('app-1', tok)).toBe(true);
  });

  it('issued token does NOT verify against a different appId', () => {
    const tok = issueCsrfToken('app-1');
    expect(verifyCsrfToken('app-2', tok)).toBe(false);
  });

  it('rejects a tampered signature', () => {
    const tok = issueCsrfToken('app-1');
    const [exp, sig] = tok.split('.', 2);
    const tampered = `${exp}.${'A'.repeat(sig.length)}`;
    expect(verifyCsrfToken('app-1', tampered)).toBe(false);
  });

  it('rejects an expired token', () => {
    const past = Date.now() - 30 * 60_000; // 30 min ago
    const tok = issueCsrfToken('app-1', past);
    expect(verifyCsrfToken('app-1', tok)).toBe(false);
  });

  it('rejects null / empty / malformed', () => {
    expect(verifyCsrfToken('app-1', null)).toBe(false);
    expect(verifyCsrfToken('app-1', '')).toBe(false);
    expect(verifyCsrfToken('app-1', 'not-a-token')).toBe(false);
    expect(verifyCsrfToken('app-1', '123.')).toBe(false);
    expect(verifyCsrfToken('app-1', '.sig')).toBe(false);
  });

  it('exp portion is ~15 minutes in the future', () => {
    const before = Math.floor(Date.now() / 1000);
    const tok = issueCsrfToken('app-1');
    const exp = Number.parseInt(tok.split('.')[0], 10);
    expect(exp).toBeGreaterThanOrEqual(before + 15 * 60 - 2);
    expect(exp).toBeLessThanOrEqual(before + 15 * 60 + 2);
  });
});

describe('PRP-020 — withTenantContext source contract', () => {
  const src = readFileSync(join(process.cwd(), 'lib', 'pbv', 'tenantEndpoint.ts'), 'utf8');

  it('verifies X-CSRF-Token on POST/PUT/PATCH/DELETE', () => {
    expect(src).toMatch(/CSRF_METHODS_TO_VERIFY/);
    expect(src).toMatch(/x-csrf-token/i);
    expect(src).toMatch(/verifyCsrfToken/);
  });

  it('Phase 1 logs WARN, does not 403 (documented follow-up flips to strict)', () => {
    expect(src).toMatch(/Phase 1[\s\S]{0,200}do NOT 403/);
    expect(src).toMatch(/\[csrf\]/);
  });

  it('issues _csrf on successful GET responses', () => {
    expect(src).toMatch(/issueCsrfToken/);
    expect(src).toMatch(/_csrf/);
  });

  it('did NOT remove the PRP-002 rate limiter', () => {
    expect(src).toMatch(/checkRateLimit/);
    expect(src).toMatch(/PRP-002/);
  });
});

describe('PRP-020 / F3 — in-app browser detection', () => {
  it('detects Instagram', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) Instagram 245.0.0.18.110')).toBe(true);
  });
  it('detects Facebook (FBAV)', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) FBAV/375.0.0.31.95')).toBe(true);
  });
  it('detects LinkedIn / Twitter / TikTok / Messenger', () => {
    expect(isInAppBrowser('LinkedInApp/9.5.0')).toBe(true);
    expect(isInAppBrowser('Twitter for iPhone')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) TikTok')).toBe(true);
    expect(isInAppBrowser('Mozilla/5.0 Messenger/375.0')).toBe(true);
  });
  it('does NOT flag regular Safari / Chrome', () => {
    expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false);
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36')).toBe(false);
  });
  it('returns false on empty / non-string', () => {
    expect(isInAppBrowser('')).toBe(false);
  });
});
