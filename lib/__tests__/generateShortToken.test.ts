import { describe, it, expect } from 'vitest';
import { generateShortToken } from '@/lib/generateToken';

describe('generateShortToken', () => {
  it('returns the requested length (default 16)', () => {
    expect(generateShortToken()).toHaveLength(16);
    expect(generateShortToken(12)).toHaveLength(12);
    expect(generateShortToken(22)).toHaveLength(22);
    expect(generateShortToken(1)).toHaveLength(1);
  });

  it('uses only the base62 alphabet [0-9A-Za-z]', () => {
    const re = /^[0-9A-Za-z]+$/;
    for (let i = 0; i < 200; i++) {
      const t = generateShortToken();
      expect(t).toMatch(re);
    }
  });

  it('produces no duplicates over 1,000 samples (collision sanity)', () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateShortToken());
    expect(set.size).toBe(1000);
  });

  it('exercises every alphabet character across many samples', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      for (const c of generateShortToken(32)) seen.add(c);
    }
    // Should hit at least 50 of the 62 possible chars in 32k draws.
    expect(seen.size).toBeGreaterThanOrEqual(50);
  });

  it('throws on invalid length', () => {
    expect(() => generateShortToken(0)).toThrow();
    expect(() => generateShortToken(-1)).toThrow();
    expect(() => generateShortToken(1.5)).toThrow();
  });
});
