import { buildingsWithParking } from './buildings';

export interface BuildingRequirements {
  /** Building requires on-site parking permits (has dedicated lot) */
  requires_parking_permit: boolean;
  /** Building requires renters insurance from all tenants */
  requires_renters_insurance: boolean;
}

export function getBuildingRequirements(buildingAddress: string): BuildingRequirements {
  return {
    requires_parking_permit: buildingsWithParking.has(buildingAddress),
    requires_renters_insurance: true, // universal requirement
  };
}
