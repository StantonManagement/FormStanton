/**
 * lib/pbv/ssnValidation.ts
 *
 * Shared SSN normalization + validation for tenant and staff entry points.
 * Never logs SSN values. Used by:
 *   - tenant intake SSN endpoint
 *   - admin member SSN write endpoint
 *   - client-side formatting in SectionHousehold
 */

/** Strip everything except digits. */
export function normalizeSsn(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}

/** Format a 9-digit string as XXX-XX-XXXX for display/entry. Partial input is formatted progressively. */
export function formatSsn(input: string): string {
  const d = normalizeSsn(input).slice(0, 9);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/**
 * Validate a full 9-digit SSN against SSA structural rules.
 * Rejects known-invalid ranges so obviously bad data never reaches the forms.
 *   - must be exactly 9 digits
 *   - area (first 3) may not be 000, 666, or 900-999
 *   - group (middle 2) may not be 00
 *   - serial (last 4) may not be 0000
 */
export function isValidSsn(input: string): boolean {
  const d = normalizeSsn(input);
  if (d.length !== 9) return false;
  const area = d.slice(0, 3);
  const group = d.slice(3, 5);
  const serial = d.slice(5);
  if (area === '000' || area === '666') return false;
  if (Number(area) >= 900) return false;
  if (group === '00') return false;
  if (serial === '0000') return false;
  return true;
}

/** True if the input is a usable last-4 fragment (exactly 4 digits) and not a full SSN. */
export function isLastFourOnly(input: string): boolean {
  return normalizeSsn(input).length === 4;
}
