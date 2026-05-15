/**
 * lib/pbv/nameMatch.ts
 *
 * Soft-match algorithm for per-signer identity verification (PRD-27).
 *
 * Algorithm (documented per closed decision):
 *   1. Lowercase + trim both strings
 *   2. NFD-normalize + strip combining diacritics (accent-normalize)
 *   3. Strip middle initials (single-char tokens other than first and last)
 *   4. Collapse whitespace to single spaces
 *   5. Compare for equality
 *
 * Returns: 'match' | 'mismatch'
 * The UI warns on mismatch but does not block (per PRD-27 § 4).
 */

export type NameMatchResult = 'match' | 'mismatch';

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function dropMiddleInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 2) return name;
  const filtered = parts.filter((p, i) => {
    if (i === 0 || i === parts.length - 1) return true;
    return p.length > 1;
  });
  return filtered.join(' ');
}

export function softMatchName(typed: string, expected: string): NameMatchResult {
  const a = dropMiddleInitials(normalize(typed));
  const b = dropMiddleInitials(normalize(expected));
  return a === b ? 'match' : 'mismatch';
}
