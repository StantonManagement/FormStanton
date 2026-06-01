import { describe, it, expect } from 'vitest';
import { normalizeSsn, formatSsn, isValidSsn, isLastFourOnly } from '../ssnValidation';

describe('normalizeSsn', () => {
  it('strips all non-digits', () => {
    expect(normalizeSsn('123-45-6789')).toBe('123456789');
    expect(normalizeSsn(' 123 45 6789 ')).toBe('123456789');
    expect(normalizeSsn('abc')).toBe('');
  });
});

describe('formatSsn', () => {
  it('formats progressively as XXX-XX-XXXX', () => {
    expect(formatSsn('123')).toBe('123');
    expect(formatSsn('12345')).toBe('123-45');
    expect(formatSsn('123456789')).toBe('123-45-6789');
  });
  it('caps at 9 digits', () => {
    expect(formatSsn('1234567890123')).toBe('123-45-6789');
  });
});

describe('isValidSsn', () => {
  it('accepts a structurally valid 9-digit SSN', () => {
    expect(isValidSsn('123456789')).toBe(true);
    expect(isValidSsn('123-45-6789')).toBe(true);
  });
  it('rejects wrong length', () => {
    expect(isValidSsn('1234')).toBe(false);
    expect(isValidSsn('1234567890')).toBe(false);
  });
  it('rejects SSA-invalid ranges (area 000/666/900+, group 00, serial 0000)', () => {
    expect(isValidSsn('000456789')).toBe(false);
    expect(isValidSsn('666456789')).toBe(false);
    expect(isValidSsn('900456789')).toBe(false);
    expect(isValidSsn('123006789')).toBe(false);
    expect(isValidSsn('123450000')).toBe(false);
  });
});

describe('isLastFourOnly', () => {
  it('is true for exactly four digits', () => {
    expect(isLastFourOnly('7407')).toBe(true);
  });
  it('is false for full SSN or partials', () => {
    expect(isLastFourOnly('123456789')).toBe(false);
    expect(isLastFourOnly('740')).toBe(false);
  });
});
