import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { normalizeAddress, unitsMatch } from '@/lib/addressNormalizer';
import { buildingUnits } from '@/lib/buildings';
import { PARKING_FEES } from '@/lib/policyContent';
import { getBuildingRequirements } from '@/lib/buildingRequirements';
import { computeColumnStats } from '@/lib/complianceColumns';
import type { MatrixRow, BuildingMatrixStats, BuildingMatrixResponse } from '@/types/compliance';

/** Calculate total monthly pet rent from a submission's pets array */
function calculatePetFee(sub: any): number | null {
  if (!sub?.has_pets) return null;
  const pets = sub.pets;
  if (!Array.isArray(pets) || pets.length === 0) return null;

  let total = 0;
  for (const pet of pets) {
    const type = (pet.pet_type || pet.type || '').toLowerCase();
    const rawWeight = pet.pet_weight ?? pet.weight ?? '';
    const weight = typeof rawWeight === 'number' ? rawWeight : parseFloat(String(rawWeight)) || 0;

    if (type === 'cat') {
      total += 25;
    } else if (type === 'dog') {
      if (weight > 50) total += 45;
      else if (weight >= 25) total += 35;
      else total += 25;
    } else {
      // Unknown pet type — default to $25
      total += 25;
    }
  }
  return total;
}

/** Calculate monthly parking permit fee from a submission (primary + additional vehicles) */
function calculatePermitFee(sub: any): number | null {
  if (!sub?.has_vehicle) return null;

  const feeMap: Record<string, number> = {
    moped: PARKING_FEES.moped,
    standard: PARKING_FEES.standard,
    oversized: PARKING_FEES.oversized,
    boat: PARKING_FEES.boats,
  };

  // Primary vehicle fee
  let total = feeMap[sub.vehicle_type] ?? PARKING_FEES.standard;

  // Additional vehicles
  if (Array.isArray(sub.additional_vehicles)) {
    for (const v of sub.additional_vehicles) {
      total += feeMap[v.vehicle_type] ?? PARKING_FEES.standard;
    }
  }

  return total;
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' } satisfies Partial<BuildingMatrixResponse>,
        { status: 401 }
      );
    }

    const buildingAddress = request.nextUrl.searchParams.get('building');
    if (!buildingAddress) {
      return NextResponse.json(
        { success: false, message: 'Building address required' } satisfies Partial<BuildingMatrixResponse>,
        { status: 400 }
      );
    }

    const normalizedBuilding = normalizeAddress(buildingAddress);

    // --- Fetch submissions for this building ---
    // Use broad fetch + normalized address filter (not exact .eq) to handle
    // address variants like "Squire Street" vs "Squire St"
    const { data: allSubmissions, error: subError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .is('merged_into', null)
      .order('unit_number', { ascending: true });

    const submissions = (allSubmissions || []).filter(
      s => normalizeAddress(s.building_address || '') === normalizedBuilding
    );

    if (subError) {
      console.error('building-matrix: submissions query error', subError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch submissions' } satisfies Partial<BuildingMatrixResponse>,
        { status: 500 }
      );
    }

    // --- Fetch tenant lookup data for this building ---
    const { data: tenants, error: tenantError } = await supabaseAdmin
      .from('tenant_lookup')
      .select('name, first_name, last_name, email, phone, unit_number, building_address')
      .eq('is_current', true);

    if (tenantError) {
      console.error('building-matrix: tenant_lookup query error', tenantError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch tenant data' } satisfies Partial<BuildingMatrixResponse>,
        { status: 500 }
      );
    }

    // Filter tenants to this building by normalized address
    const buildingTenants = (tenants || []).filter(t => {
      if (t.name === 'Occupied Unit') return false;
      return normalizeAddress(t.building_address || '') === normalizedBuilding;
    });

    // Known units for this building
    const knownUnits = buildingUnits[buildingAddress] || [];

    // Build a map: unit → submission (first non-merged match wins)
    const subsByUnit = new Map<string, any>();
    for (const sub of submissions || []) {
      // Find the canonical unit this submission maps to
      const canonicalUnit = knownUnits.find(u => unitsMatch(sub.unit_number, u)) || sub.unit_number;
      if (!subsByUnit.has(canonicalUnit)) {
        subsByUnit.set(canonicalUnit, sub);
      }
    }

    // Build a map: unit → tenant lookup record
    const tenantByUnit = new Map<string, any>();
    for (const t of buildingTenants) {
      const canonicalUnit = knownUnits.find(u => unitsMatch(t.unit_number, u)) || t.unit_number;
      if (!tenantByUnit.has(canonicalUnit)) {
        tenantByUnit.set(canonicalUnit, t);
      }
    }

    // Determine the full set of units to show (union of known units + any submission/tenant units)
    const allUnits = new Set<string>(knownUnits);
    for (const key of subsByUnit.keys()) allUnits.add(key);
    for (const key of tenantByUnit.keys()) allUnits.add(key);

    // Sort units: retail first, then numeric
    const sortedUnits = Array.from(allUnits).sort((a, b) => {
      const aRetail = a.toLowerCase().includes('retail') || a.toLowerCase().includes('com');
      const bRetail = b.toLowerCase().includes('retail') || b.toLowerCase().includes('com');
      if (aRetail && !bRetail) return 1;
      if (!aRetail && bRetail) return -1;
      const aNum = parseInt(a.match(/\d+/)?.[0] || '999');
      const bNum = parseInt(b.match(/\d+/)?.[0] || '999');
      return aNum - bNum;
    });

    // Helper: build submission content summaries
    function buildVehicleSummary(sub: any): string | null {
      if (!sub?.has_vehicle) return null;
      const parts: string[] = [];
      const desc = [sub.vehicle_year, sub.vehicle_make, sub.vehicle_model].filter(Boolean).join(' ');
      if (desc) parts.push(desc);
      if (sub.vehicle_color) parts.push(sub.vehicle_color);
      if (sub.vehicle_plate) parts.push(sub.vehicle_plate);
      return parts.length > 0 ? parts.join(' · ') : 'Vehicle (no details)';
    }

    function buildPetSummary(sub: any): string | null {
      if (!sub?.has_pets) return null;
      const pets = sub.pets;
      if (Array.isArray(pets) && pets.length > 0) {
        if (pets.length === 1) {
          const p = pets[0];
          const parts = [p.type || p.species, p.breed, p.name].filter(Boolean);
          return parts.length > 0 ? parts.join(' · ') : '1 pet';
        }
        return `${pets.length} pets`;
      }
      return 'Pets (no details)';
    }

    function buildInsuranceSummary(sub: any): string | null {
      if (!sub?.has_insurance) return null;
      const parts: string[] = [];
      if (sub.insurance_provider) parts.push(sub.insurance_provider);
      if (sub.insurance_expiration_date) parts.push(`exp ${sub.insurance_expiration_date}`);
      return parts.length > 0 ? parts.join(' · ') : 'Insurance (no details)';
    }

    // Build matrix rows
    const reqs = getBuildingRequirements(buildingAddress);
    const rows: MatrixRow[] = [];
    for (const unit of sortedUnits) {
      const sub = subsByUnit.get(unit);
      const tenant = tenantByUnit.get(unit);
      const isOccupied = !!tenant;
      const hasSub = !!sub;

      if (!isOccupied && !hasSub) {
        continue;
      }

      const tenantName = tenant
        ? (tenant.name || `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim())
        : null;

      const exemptionDocs = Array.isArray(sub?.exemption_documents)
        ? sub.exemption_documents.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0)
        : [];
      const esaDocFile = exemptionDocs[0] ?? null;
      const hasEsaDoc =
        (sub?.exemption_reason ?? null) === 'emotional_support'
        || exemptionDocs.length > 0
        || (sub?.esa_doc_uploaded_to_appfolio ?? false);

      rows.push({
        unit_number: unit,
        submission_id: sub?.id || null,
        full_name: sub?.full_name || null,
        phone: sub?.phone || tenant?.phone || null,
        email: sub?.email || tenant?.email || null,
        building_address: buildingAddress,
        created_at: sub?.created_at || null,

        has_vehicle: sub?.has_vehicle ?? false,
        has_pets: sub?.has_pets ?? false,
        has_insurance: (sub?.has_insurance ?? false) || reqs.requires_renters_insurance,
        has_esa_doc: hasEsaDoc,

        vehicle_addendum_file: sub?.vehicle_addendum_file || null,
        pet_addendum_file: sub?.pet_addendum_file || null,
        insurance_file: sub?.insurance_file || null,
        esa_doc_file: esaDocFile,

        vehicle_addendum_uploaded_to_appfolio: sub?.vehicle_addendum_uploaded_to_appfolio ?? false,
        vehicle_addendum_uploaded_to_appfolio_at: sub?.vehicle_addendum_uploaded_to_appfolio_at || null,
        vehicle_addendum_uploaded_to_appfolio_by: sub?.vehicle_addendum_uploaded_to_appfolio_by || null,
        pet_addendum_uploaded_to_appfolio: sub?.pet_addendum_uploaded_to_appfolio ?? false,
        pet_addendum_uploaded_to_appfolio_at: sub?.pet_addendum_uploaded_to_appfolio_at || null,
        pet_addendum_uploaded_to_appfolio_by: sub?.pet_addendum_uploaded_to_appfolio_by || null,
        insurance_uploaded_to_appfolio: sub?.insurance_uploaded_to_appfolio ?? false,
        insurance_uploaded_to_appfolio_at: sub?.insurance_uploaded_to_appfolio_at || null,
        insurance_uploaded_to_appfolio_by: sub?.insurance_uploaded_to_appfolio_by || null,
        esa_doc_uploaded_to_appfolio: sub?.esa_doc_uploaded_to_appfolio ?? false,
        esa_doc_uploaded_to_appfolio_at: sub?.esa_doc_uploaded_to_appfolio_at || null,
        esa_doc_uploaded_to_appfolio_by: sub?.esa_doc_uploaded_to_appfolio_by || null,

        pet_fee_added_to_appfolio: sub?.pet_fee_added_to_appfolio ?? false,
        pet_fee_added_to_appfolio_at: sub?.pet_fee_added_to_appfolio_at || null,
        pet_fee_added_to_appfolio_by: sub?.pet_fee_added_to_appfolio_by || null,
        pet_fee_amount: sub?.pet_fee_amount ?? null,
        permit_fee_added_to_appfolio: sub?.permit_fee_added_to_appfolio ?? false,
        permit_fee_added_to_appfolio_at: sub?.permit_fee_added_to_appfolio_at || null,
        permit_fee_added_to_appfolio_by: sub?.permit_fee_added_to_appfolio_by || null,
        permit_fee_amount: sub?.permit_fee_amount ?? null,

        permit_issued: sub?.permit_issued ?? false,
        permit_issued_at: sub?.permit_issued_at || null,
        permit_issued_by: sub?.permit_issued_by || null,
        tenant_picked_up: sub?.tenant_picked_up ?? false,
        tenant_picked_up_at: sub?.tenant_picked_up_at || null,

        permit_entered_in_appfolio: sub?.permit_entered_in_appfolio ?? false,
        permit_entered_in_appfolio_at: sub?.permit_entered_in_appfolio_at || null,
        permit_entered_in_appfolio_by: sub?.permit_entered_in_appfolio_by || null,

        pickup_id_photo: sub?.pickup_id_photo || null,
        pickup_id_uploaded_to_appfolio: sub?.pickup_id_uploaded_to_appfolio ?? false,
        pickup_id_uploaded_to_appfolio_at: sub?.pickup_id_uploaded_to_appfolio_at || null,
        pickup_id_uploaded_to_appfolio_by: sub?.pickup_id_uploaded_to_appfolio_by || null,

        pickup_count: sub?.pickup_count ?? 0,
        pickup_events: Array.isArray(sub?.pickup_events) ? sub.pickup_events : [],

        permit_revoked: sub?.permit_revoked ?? false,
        permit_revoked_at: sub?.permit_revoked_at || null,
        permit_revoked_by: sub?.permit_revoked_by || null,
        permit_revoked_reason: sub?.permit_revoked_reason || null,
        permit_revoked_notes: sub?.permit_revoked_notes || null,
        tow_flagged: sub?.tow_flagged ?? false,
        towed_at: sub?.towed_at || null,
        towed_by: sub?.towed_by || null,

        vehicle_plate: sub?.vehicle_plate || null,
        vehicle_make: sub?.vehicle_make || null,
        vehicle_model: sub?.vehicle_model || null,
        vehicle_year: sub?.vehicle_year ?? null,
        vehicle_color: sub?.vehicle_color || null,

        vehicle_verified: sub?.vehicle_verified ?? false,
        pet_verified: sub?.pet_verified ?? false,
        insurance_verified: sub?.insurance_verified ?? false,

        calculated_pet_fee: calculatePetFee(sub),
        calculated_permit_fee: calculatePermitFee(sub),

        vehicle_summary: buildVehicleSummary(sub),
        pet_summary: buildPetSummary(sub),
        insurance_summary: buildInsuranceSummary(sub),

        requires_parking_permit: reqs.requires_parking_permit && (sub?.has_vehicle ?? false),

        lobby_notes: sub?.lobby_notes || null,
        lobby_notes_processed: sub?.lobby_notes_processed ?? false,

        missing: isOccupied && !hasSub,
        tenant_lookup_name: tenantName,
      });
    }

    // Compute aggregate stats via column registry
    const withSub = rows.filter(r => !r.missing);
    const stats: BuildingMatrixStats = {
      total_units: knownUnits.length,
      occupied_units: buildingTenants.length,
      submissions: withSub.length,
      missing_submissions: rows.filter(r => r.missing).length,
      columns: computeColumnStats(withSub),
      unprocessed_notes_count: withSub.filter(r => r.lobby_notes && !r.lobby_notes_processed).length,
    };

    const response: BuildingMatrixResponse = {
      success: true,
      building: buildingAddress,
      rows,
      stats,
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('building-matrix error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to build matrix' } satisfies Partial<BuildingMatrixResponse>,
      { status: 500 }
    );
  }
}
