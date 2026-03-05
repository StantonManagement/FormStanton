# Parking-Based Multi-Vehicle Logic Implementation

## Summary

Successfully implemented parking-based restrictions for multi-vehicle registration. The system now uses the `buildingParkingSpots` data to determine whether tenants can register additional vehicles.

## Implementation Details

### 1. Helper Function (`lib/buildingAssetIds.ts`)

Created `allowsMultipleVehicles(buildingAddress: string): boolean` function with the following logic:

- **Buildings with ≥10 parking spots**: Allow multiple vehicles
- **Buildings with <10 parking spots**: Restrict to 1 vehicle only
- **Buildings with "Street" parking**: Allow multiple vehicles (street parking is abundant)
- **Buildings with no parking data**: Restrict to 1 vehicle (safe default)

### 2. Form Logic Updates (`app/form/page.tsx`)

- Imported `allowsMultipleVehicles` helper function
- Added `canHaveMultipleVehicles` variable that evaluates for the selected building
- Conditionally show additional vehicle section only when `canHaveMultipleVehicles === true`
- Display informative message when building has limited parking

### 3. Translation Keys (`lib/translations.ts`)

Added `limitedParkingMessage` in all three languages:

- **English**: "Due to limited parking at this building, only one vehicle per unit is permitted. Additional vehicles cannot be accommodated."
- **Spanish**: "Debido al estacionamiento limitado en este edificio, solo se permite un vehículo por unidad. No se pueden acomodar vehículos adicionales."
- **Portuguese**: "Devido ao estacionamento limitado neste prédio, apenas um veículo por unidade é permitido. Veículos adicionais não podem ser acomodados."

## Examples

### Buildings Allowing Multiple Vehicles (≥10 spots or Street parking)

- **90 Park Street**: 15 spots → ✅ Multiple vehicles allowed
- **195 Affleck St**: 20 spots → ✅ Multiple vehicles allowed
- **110 Martin St**: 12 spots → ✅ Multiple vehicles allowed
- **97-103 Maple Ave**: "Street" → ✅ Multiple vehicles allowed

### Buildings Restricting to 1 Vehicle (<10 spots)

- **120 Martin St**: 3 spots → ❌ Only 1 vehicle allowed
- **164 Seymour St**: 3 spots → ❌ Only 1 vehicle allowed
- **91 Edwards St**: 3 spots → ❌ Only 1 vehicle allowed
- **170 Seymour St**: 4 spots → ❌ Only 1 vehicle allowed
- **236 Maple Ave**: 0 spots → ❌ Only 1 vehicle allowed

## User Experience

When a tenant selects their building and indicates they have a vehicle:

1. **Limited parking building**: They see a yellow/amber alert message explaining only one vehicle is permitted
2. **Ample parking building**: They see the green section asking if they want to request additional parking spaces

This provides clear, immediate feedback based on their building's parking availability.
