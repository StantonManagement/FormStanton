// Address normalization utility to handle variations in building addresses

/**
 * Normalizes building addresses to match canonical format in buildings.ts
 * Handles common variations like "Street" vs "St", missing suffixes, etc.
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  let normalized = address.trim();
  
  // Normalize "Street" to "St"
  normalized = normalized.replace(/\sStreet$/i, ' St');
  
  // Fix backwards format "Affleck St 192" -> "192 Affleck St"
  const backwardsMatch = normalized.match(/^([A-Za-z\s-]+)\s+(\d+[-\d]*)$/);
  if (backwardsMatch) {
    normalized = `${backwardsMatch[2]} ${backwardsMatch[1]}`;
  }
  
  // Add missing "St" suffix for known Seymour addresses
  if (/^\d+\s+Seymour$/i.test(normalized)) {
    normalized = normalized + ' St';
  }
  
  // Handle bare numbers that should be Seymour St addresses
  if (/^(142|158|164|167|169|170|180)$/.test(normalized)) {
    normalized = normalized + ' Seymour St';
  }
  
  // Handle bare numbers that should be Affleck St addresses
  if (/^(144|178|179|182|190|192|195)$/.test(normalized)) {
    normalized = normalized + ' Affleck St';
  }
  
  return normalized;
}

/**
 * Checks if two addresses match after normalization
 */
export function addressesMatch(addr1: string, addr2: string): boolean {
  return normalizeAddress(addr1) === normalizeAddress(addr2);
}

/**
 * Normalizes unit numbers to handle variations like "1NE", "1-NE", "Unit 1NE", etc.
 */
export function normalizeUnit(unit: string): string {
  if (!unit) return '';
  
  return unit
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/unit/gi, '')
    .replace(/#/g, '')
    .replace(/apt/gi, '')
    .replace(/-/g, '')
    .replace(/\./g, '');
}

/**
 * Checks if two unit numbers match after normalization
 */
export function unitsMatch(unit1: string, unit2: string): boolean {
  const normalized1 = normalizeUnit(unit1);
  const normalized2 = normalizeUnit(unit2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return true;
  
  // Partial match (one contains the other)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  return false;
}

/**
 * Filters submissions by building address with fuzzy matching
 */
export function filterByBuilding<T extends { building_address: string }>(
  items: T[],
  buildingAddress: string
): T[] {
  const normalizedBuilding = normalizeAddress(buildingAddress);
  return items.filter(item => 
    normalizeAddress(item.building_address) === normalizedBuilding
  );
}
