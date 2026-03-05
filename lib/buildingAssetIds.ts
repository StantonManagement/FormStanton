// Asset ID mapping from acct_property_master table
export const buildingToAssetId: Record<string, string> = {
  "90 Park Street": "S0001",
  "97-103 Maple Ave": "S0002",
  "222-224 Maple Ave": "S0003",
  "43-45 Franklin Ave": "S0004",
  "47 Franklin Ave": "S0005",
  "15-17 Whitmore Street": "S0006",
  "36 Whitmore Street": "S0007",
  "38-40 Whitmore Street": "S0008",
  "236 Maple Ave": "S0009",
  "228 Maple Ave": "S0010",
  "110 Martin St": "S0011",
  "120 Martin St": "S0012",
  "152-154 Wooster St": "S0013",
  "160 Wooster St": "S0014",
  "165 Westland St": "S0015",
  "1721-1739 Main St": "S0016",
  "69-73 Chestnut St": "S0017",
  "91 Edwards St": "S0018",
  "93-95 Maple Ave": "S0019",
  "31-33 Park St": "S0020",
  "67-73 Park St": "S0021",
  "83-91 Park St": "S0022",
  "57 Park St": "S0023",
  "10 Wolcott St": "S0024",
  "179 Affleck St": "S0025",
  "144-146 Affleck St": "S0026",
  "178 Affleck St": "S0027",
  "182 Affleck St": "S0028",
  "190 Affleck St": "S0029",
  "195 Affleck St": "S0030",
  "88-90 Ward St": "S0031",
  "865 Broad St": "S0032",
  "142 Seymour St": "S0033",
  "158 Seymour St": "S0034",
  "164 Seymour St": "S0035",
  "167 Seymour St": "S0036",
  "169 Seymour St": "S0037",
  "170 Seymour St": "S0038",
  "180 Seymour St": "S0039",
  "213-217 Buckingham St": "S0040",
  "23-31 Squire St": "S0041",
};

// Parking spots count per building
export const buildingParkingSpots: Record<string, number | string> = {
  "90 Park Street": 15,
  "97-103 Maple Ave": "Street",
  "222-224 Maple Ave": "Street",
  "43-45 Franklin Ave": "Street",
  "47 Franklin Ave": 5,
  "15-17 Whitmore Street": 8,
  "36 Whitmore Street": 6,
  "38-40 Whitmore Street": 6,
  "236 Maple Ave": 0,
  "228 Maple Ave": "Street",
  "110 Martin St": 12,
  "120 Martin St": 3,
  "152-154 Wooster St": 6,
  "160 Wooster St": 6,
  "165 Westland St": "Street",
  "1721-1739 Main St": 8,
  "69-73 Chestnut St": 8,
  "91 Edwards St": 3,
  "93-95 Maple Ave": "Street",
  "31-33 Park St": 6,
  "67-73 Park St": 3,
  "83-91 Park St": 3,
  "57 Park St": 4,
  "10 Wolcott St": 7,
  "179 Affleck St": 6,
  "144-146 Affleck St": 20,
  "178 Affleck St": 12,
  "182 Affleck St": 7,
  "190 Affleck St": "Street",
  "195 Affleck St": 20,
  "88-90 Ward St": 10,
  "865 Broad St": "Street",
  "142 Seymour St": "Street",
  "158 Seymour St": 5,
  "164 Seymour St": 3,
  "167 Seymour St": 12,
  "169 Seymour St": 10,
  "170 Seymour St": 4,
  "180 Seymour St": "Street",
  "213-217 Buckingham St": "Street",
  "23-31 Squire St": 8,
};

// Sort buildings by Asset ID
export function sortBuildingsByAssetId(buildings: string[]): string[] {
  return buildings.sort((a, b) => {
    const assetA = buildingToAssetId[a] || 'Z9999';
    const assetB = buildingToAssetId[b] || 'Z9999';
    return assetA.localeCompare(assetB);
  });
}

// Determine if a building allows multiple vehicles based on parking availability
export function allowsMultipleVehicles(buildingAddress: string): boolean {
  const parkingSpots = buildingParkingSpots[buildingAddress];
  
  // If no parking data, default to not allowing multiple vehicles
  if (!parkingSpots) return false;
  
  // Street parking allows multiple vehicles (abundant parking)
  if (parkingSpots === "Street") return true;
  
  // Buildings with 10 or more spots allow multiple vehicles
  // Buildings with fewer than 10 spots restrict to 1 vehicle per tenant
  return typeof parkingSpots === 'number' && parkingSpots >= 10;
}
