import { describe, it, expect } from 'vitest';
import { computeAge } from '../age';

function daysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function yearsAgoExact(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function yearsAgoTomorrow(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('computeAge', () => {
  it('returns null for empty string', () => {
    expect(computeAge('')).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(computeAge('not-a-date')).toBeNull();
  });

  it('returns 0 for DOB exactly today', () => {
    expect(computeAge(daysFromToday(0))).toBe(0);
  });

  it('returns 0 for DOB tomorrow (birthday has not occurred yet)', () => {
    expect(computeAge(daysFromToday(1))).toBe(-1);
  });

  it('returns correct age for DOB 62 years ago today', () => {
    expect(computeAge(yearsAgoExact(62))).toBe(62);
  });

  it('returns 61 when birthday is tomorrow for a 62-year-old', () => {
    expect(computeAge(yearsAgoTomorrow(62))).toBe(61);
  });

  it('handles leap-year DOB (Feb 29) without throwing', () => {
    const age = computeAge('1960-02-29');
    expect(typeof age).toBe('number');
    expect(age).toBeGreaterThan(0);
  });

  it('returns 18 for DOB exactly 18 years ago today', () => {
    expect(computeAge(yearsAgoExact(18))).toBe(18);
  });

  it('returns 17 when 18th birthday is tomorrow', () => {
    expect(computeAge(yearsAgoTomorrow(18))).toBe(17);
  });
});
