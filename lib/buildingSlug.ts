/**
 * Build a URL-safe slug like "222-224-maple-ave-unit-2n" from a free-form
 * building address and unit number. Used as a human-readable prefix on
 * tenant magic-link tokens so support staff can identify the unit at a
 * glance from the URL.
 */
export function buildingUnitSlug(building: string, unit: string): string {
  const clean = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${clean(building)}-unit-${clean(unit)}`;
}
