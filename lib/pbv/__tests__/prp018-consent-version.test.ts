/**
 * PRP-018 / G1 — consent-version integrity tests.
 *
 * Pure-unit on the local allow-list + source-grep that sign-summary
 * actually enforces it. The DB-side validation lands when the migration
 * is applied (deferred runtime gate).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONSENT_TEXT_VERSION,
  KNOWN_CONSENT_VERSIONS,
  isKnownConsentVersion,
} from '@/lib/pbv/consent-text';

describe('PRP-018 / G1 — consent-version allow-list', () => {
  it('CONSENT_TEXT_VERSION is in KNOWN_CONSENT_VERSIONS (bump procedure)', () => {
    expect(KNOWN_CONSENT_VERSIONS).toContain(CONSENT_TEXT_VERSION);
  });
  it('isKnownConsentVersion accepts the active version', () => {
    expect(isKnownConsentVersion('2026-05-15-v1')).toBe(true);
  });
  it('isKnownConsentVersion rejects unknown values', () => {
    expect(isKnownConsentVersion('1999-01-01-vx')).toBe(false);
    expect(isKnownConsentVersion('')).toBe(false);
    expect(isKnownConsentVersion(null as any)).toBe(false);
    expect(isKnownConsentVersion(undefined)).toBe(false);
  });
});

describe('PRP-018 / G1 — sign-summary route enforces the allow-list', () => {
  const src = readFileSync(
    join(
      process.cwd(),
      'app',
      'api',
      't',
      '[token]',
      'pbv-full-app',
      'sign-summary',
      'route.ts'
    ),
    'utf8'
  );
  it('imports isKnownConsentVersion', () => {
    expect(src).toMatch(/isKnownConsentVersion[^;]*from\s+['"]@\/lib\/pbv\/consent-text['"]/);
  });
  it("returns 400 unknown_consent_version when isKnownConsentVersion(consent_text_version) is false", () => {
    expect(src).toMatch(/!isKnownConsentVersion\(consent_text_version\)/);
    expect(src).toMatch(/unknown_consent_version/);
  });
});

describe('PRP-018 / G1 — consent_versions migration seeded', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '20260521110000_consent_versions.sql'),
    'utf8'
  );
  it('creates the consent_versions table', () => {
    expect(src).toMatch(/CREATE TABLE IF NOT EXISTS consent_versions/);
  });
  it("seeds the '2026-05-15-v1' row", () => {
    expect(src).toMatch(/INSERT INTO consent_versions[\s\S]+'2026-05-15-v1'/);
  });
  it('has the ON CONFLICT (version) DO NOTHING idempotency clause', () => {
    expect(src).toMatch(/ON CONFLICT \(version\) DO NOTHING/);
  });
});
