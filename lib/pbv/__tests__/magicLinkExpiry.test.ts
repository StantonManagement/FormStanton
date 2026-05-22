/**
 * PRD-78 #8 — magic-link expiry helper.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isMagicLinkExpired } from '../magicLinkExpiry';

describe('isMagicLinkExpired', () => {
  const FIXED_NOW = new Date('2026-05-21T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when expiresAt is null', () => {
    expect(isMagicLinkExpired(null)).toBe(true);
  });

  it('returns true when expiresAt is undefined', () => {
    expect(isMagicLinkExpired(undefined)).toBe(true);
  });

  it('returns true when expiresAt is an empty string', () => {
    expect(isMagicLinkExpired('')).toBe(true);
  });

  it('returns true when expiresAt is unparseable (fail-closed)', () => {
    expect(isMagicLinkExpired('not-a-date')).toBe(true);
    expect(isMagicLinkExpired('definitely-not-iso')).toBe(true);
  });

  it('returns true when expiresAt is in the past', () => {
    expect(isMagicLinkExpired('2026-05-20T12:00:00.000Z')).toBe(true); // 1 day ago
    expect(isMagicLinkExpired('2026-05-21T11:59:59.000Z')).toBe(true); // 1 second ago
  });

  it('returns false when expiresAt is in the future', () => {
    expect(isMagicLinkExpired('2026-05-21T12:00:01.000Z')).toBe(false); // 1 second future
    expect(isMagicLinkExpired('2026-06-20T12:00:00.000Z')).toBe(false); // 30 days future
  });

  it('handles a timestamptz string from PostgREST (with offset)', () => {
    // Postgres tz output: 2026-05-21 13:00:00+00 — parsed as UTC instant.
    expect(isMagicLinkExpired('2026-05-21T13:00:00+00:00')).toBe(false);
    expect(isMagicLinkExpired('2026-05-21T11:00:00+00:00')).toBe(true);
  });
});
