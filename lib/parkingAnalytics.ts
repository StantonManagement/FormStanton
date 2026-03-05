import { buildingParkingSpots } from './buildingAssetIds';

export interface AdditionalVehicleRequest {
  submissionId: string;
  tenantName: string;
  unitNumber: string;
  buildingAddress: string;
  primaryVehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    plate: string;
  };
  additionalVehicles: Array<{
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: number | string;
    vehicle_color: string;
    vehicle_plate: string;
    requested_at: string;
  }>;
  requestedAt: string;
  approved: boolean;
  denied: boolean;
  denialReason?: string;
}

export interface ParkingAvailability {
  buildingAddress: string;
  totalSpots: number | string;
  primaryPermitsIssued: number;
  additionalPermitsApproved: number;
  availableSpots: number;
  pendingRequests: number;
  canApproveMore: boolean;
  isStreetParking: boolean;
}

/**
 * Calculate parking availability for a building
 */
export function calculateParkingAvailability(
  buildingAddress: string,
  submissions: any[]
): ParkingAvailability {
  const totalSpots = buildingParkingSpots[buildingAddress];
  const isStreetParking = totalSpots === 'Street';

  // Count primary permits issued (has_vehicle=true, permit_issued=true)
  const primaryPermitsIssued = submissions.filter(
    (s) => s.building_address === buildingAddress && s.has_vehicle && s.permit_issued
  ).length;

  // Count additional permits approved
  const additionalPermitsApproved = submissions.filter(
    (s) =>
      s.building_address === buildingAddress &&
      s.additional_vehicle_approved &&
      s.additional_vehicles?.length > 0
  ).reduce((sum, s) => sum + (s.additional_vehicles?.length || 0), 0);

  // Count pending additional vehicle requests
  const pendingRequests = submissions.filter(
    (s) =>
      s.building_address === buildingAddress &&
      s.additional_vehicles?.length > 0 &&
      !s.additional_vehicle_approved &&
      !s.additional_vehicle_denied
  ).reduce((sum, s) => sum + (s.additional_vehicles?.length || 0), 0);

  // Calculate available spots
  let availableSpots = 0;
  let canApproveMore = false;

  if (isStreetParking) {
    // Street parking is unlimited
    availableSpots = Infinity;
    canApproveMore = true;
  } else if (typeof totalSpots === 'number') {
    const usedSpots = primaryPermitsIssued + additionalPermitsApproved;
    availableSpots = Math.max(0, totalSpots - usedSpots);
    canApproveMore = availableSpots > 0;
  }

  return {
    buildingAddress,
    totalSpots,
    primaryPermitsIssued,
    additionalPermitsApproved,
    availableSpots: isStreetParking ? Infinity : availableSpots,
    pendingRequests,
    canApproveMore,
    isStreetParking,
  };
}

/**
 * Get all additional vehicle requests for a building
 */
export function getAdditionalVehicleRequests(
  buildingAddress: string,
  submissions: any[]
): AdditionalVehicleRequest[] {
  return submissions
    .filter(
      (s) =>
        s.building_address === buildingAddress &&
        s.additional_vehicles?.length > 0
    )
    .map((s) => ({
      submissionId: s.id,
      tenantName: s.full_name,
      unitNumber: s.unit_number,
      buildingAddress: s.building_address,
      primaryVehicle: {
        make: s.vehicle_make || '',
        model: s.vehicle_model || '',
        year: s.vehicle_year || 0,
        color: s.vehicle_color || '',
        plate: s.vehicle_plate || '',
      },
      additionalVehicles: s.additional_vehicles || [],
      requestedAt: s.created_at,
      approved: s.additional_vehicle_approved || false,
      denied: s.additional_vehicle_denied || false,
      denialReason: s.additional_vehicle_denial_reason,
    }))
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime());
}

/**
 * Check if a building can approve additional permits
 */
export function canApproveAdditionalPermit(
  buildingAddress: string,
  submissions: any[]
): boolean {
  const availability = calculateParkingAvailability(buildingAddress, submissions);
  return availability.canApproveMore;
}

/**
 * Get parking status indicator (green/yellow/red)
 */
export function getParkingStatusIndicator(availability: ParkingAvailability): {
  color: string;
  emoji: string;
  label: string;
} {
  if (availability.isStreetParking) {
    return {
      color: 'blue',
      emoji: '🅿️',
      label: 'Street Parking',
    };
  }

  if (availability.availableSpots === 0) {
    return {
      color: 'red',
      emoji: '🔴',
      label: 'Full',
    };
  }

  const utilizationRate =
    (availability.primaryPermitsIssued + availability.additionalPermitsApproved) /
    (availability.totalSpots as number);

  if (utilizationRate >= 0.9) {
    return {
      color: 'yellow',
      emoji: '🟡',
      label: 'Limited',
    };
  }

  return {
    color: 'green',
    emoji: '🟢',
    label: 'Available',
  };
}
