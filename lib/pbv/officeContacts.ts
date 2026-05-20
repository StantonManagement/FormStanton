/**
 * lib/pbv/officeContacts.ts
 *
 * Office contact information for tenant-facing status banners.
 * PRD-36: Tenant-Facing Application Status (F5)
 *
 * V1: Single default contact applies to all buildings.
 * Future: Add per-building overrides keyed by building_address.
 */

export interface OfficeContact {
  name: string;
  phone: string;
  email: string;
  hours: string;
}

/**
 * Default office contact for all buildings (V1).
 * Alex confirmed 2026-05-15: info@stantoncap.com / (860) 993-3401
 */
export const defaultOfficeContact: OfficeContact = {
  name: 'Stanton Management Office',
  phone: '(860) 993-3401',
  email: 'info@stantoncap.com',
  hours: 'Monday–Friday, 9am–5pm EST',
};

/**
 * Per-building contact overrides.
 * When a building address is added here, it takes precedence over default.
 *
 * Example:
 * ```
 * '15 Whitfield Street, Guilford, CT': {
 *   name: 'Whitfield Property Office',
 *   phone: '(860) 993-3401',
 *   email: 'whitfield@stantoncap.com',
 *   hours: 'Monday–Friday, 9am–5pm EST',
 * }
 * ```
 */
export const buildingOfficeContacts: Record<string, OfficeContact> = {
  // Add per-building overrides here as needed
};

/**
 * Get office contact for a building.
 * Falls back to default if building not found.
 */
export function getOfficeContact(buildingAddress: string | null | undefined): OfficeContact {
  if (!buildingAddress) return defaultOfficeContact;

  // Normalize address for lookup (trim whitespace, lowercase for matching)
  const normalized = buildingAddress.trim();

  return buildingOfficeContacts[normalized] ?? defaultOfficeContact;
}
