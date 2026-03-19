/**
 * Parses phone numbers from tenant_lookup format into E.164.
 * 
 * Input examples:
 *   "Phone: (860) 816-5956"
 *   "Mobile: (475) 467-0645"
 *   "Home: (860) 244-1234"
 *   "(860) 816-5956"
 * 
 * Output: "+18608165956" or null if unparseable
 */
export function parsePhoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Strip known prefixes
  const stripped = raw.replace(/^(Phone|Mobile|Home|Work|Cell|Fax)\s*:\s*/i, '');

  // Extract digits only
  const digits = stripped.replace(/\D/g, '');

  // US numbers: 10 digits or 11 starting with 1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return null;
}
