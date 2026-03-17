// Address normalization utility to handle variations in building addresses

/**
 * Normalizes building addresses to match canonical format in buildings.ts
 * Handles common variations like "Street" vs "St", missing suffixes, etc.
 */
export function normalizeAddress(address: string): string {
  if (!address) return '';
  
  let normalized = address.trim();
  
  // Collapse multiple spaces: "170  Seymour" -> "170 Seymour"
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Strip city, state, zip (e.g., "Hartford, CT 06120" or "Hartford, CT 06114")
  normalized = normalized.replace(/\s+Hartford,?\s+CT\s+\d{5}$/i, '');
  
  // Normalize plus signs in ranges: "190+192" -> "190-192"
  normalized = normalized.replace(/(\d+)\+(\d+)/, '$1-$2');
  
  // Normalize dash spacing in number ranges: "1721 - 1739" -> "1721-1739"
  normalized = normalized.replace(/(\d+)\s*-\s*(\d+)/, '$1-$2');
  
  // Normalize common abbreviations
  normalized = normalized.replace(/\sStreet$/i, ' St');
  normalized = normalized.replace(/\sAvenue$/i, ' Ave');
  
  // Fix backwards format "Affleck St 192" -> "192 Affleck St"
  const backwardsMatch = normalized.match(/^([A-Za-z\s-]+)\s+(\d+[-\d]*)$/);
  if (backwardsMatch) {
    normalized = `${backwardsMatch[2]} ${backwardsMatch[1]}`;
  }
  
  // Add missing "St" suffix for known street names without suffix
  if (/^\d+[-\d]*\s+(Affleck|Seymour|Buckingham|Whitmore|Wooster|Martin|Westland|Chestnut|Edwards|Park|Ward|Broad)$/i.test(normalized)) {
    normalized = normalized + ' St';
  }
  
  // Handle bare numbers that should be Seymour St addresses
  if (/^(142|158|164|167|169|170|180)$/.test(normalized)) {
    normalized = normalized + ' Seymour St';
  }
  
  // Handle bare numbers that should be Affleck St addresses
  if (/^(144|178|179|182|184|190|192|195)$/.test(normalized)) {
    normalized = normalized + ' Affleck St';
  }
  
  // Handle building variations (99/100/101 Maple all normalize to base range)
  // 97-103 Maple, 99 Maple, 100 Maple, 101 Maple -> all become "97-103 Maple Ave"
  if (/^(97-103|99|100|101)\s+Maple/i.test(normalized)) {
    normalized = '97-103 Maple Ave';
  }
  
  // Handle 93-95 Maple range variations
  if (/^(93-95|93|94|95)\s+Maple/i.test(normalized)) {
    normalized = '93-95 Maple Ave';
  }
  
  // Handle 228-230 Maple -> canonical "228-230 Maple Ave"
  if (/^(228-230|228|230)\s+Maple/i.test(normalized)) {
    normalized = '228-230 Maple Ave';
  }
  
  // Handle 222-224 Maple range
  if (/^(222-224|222|224)\s+Maple/i.test(normalized)) {
    normalized = '222-224 Maple Ave';
  }
  
  // Handle 90-100 Park -> canonical "90-100 Park St"
  if (/^(90-100|90|100)\s+Park/i.test(normalized)) {
    normalized = '90-100 Park St';
  }
  
  // Handle 57-59 Park -> canonical "57-59 Park St"
  if (/^(57-59|57|59)\s+Park/i.test(normalized)) {
    normalized = '57-59 Park St';
  }
  
  // Handle 182-184 Affleck -> canonical "182-184 Affleck St"
  if (/^(182-184|182|184)\s+Affleck/i.test(normalized)) {
    normalized = '182-184 Affleck St';
  }
  
  // Handle 190-192 Affleck -> canonical "190-192 Affleck St"
  if (/^(190-192|190|192)\s+Affleck/i.test(normalized)) {
    normalized = '190-192 Affleck St';
  }
  
  // Handle 71-73 Chestnut -> canonical "69-73 Chestnut St"
  if (/^(69-73|71-73)\s+Chestnut/i.test(normalized)) {
    normalized = '69-73 Chestnut St';
  }
  
  // Handle 90 Edwards -> canonical "91 Edwards St"
  if (/^(90|91)\s+Edwards/i.test(normalized)) {
    normalized = '91 Edwards St';
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
