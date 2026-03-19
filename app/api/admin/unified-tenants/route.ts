import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthenticated } from '@/lib/auth';
import { normalizeAddress } from '@/lib/addressNormalizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TenantLookupRecord {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  unit_number: string;
  building_address: string;
  move_in: string | null;
  is_current: boolean;
}

interface Submission {
  id: string;
  full_name: string;
  unit_number: string;
  phone: string;
  email: string;
  building_address: string;
  has_pets: boolean;
  pet_verified: boolean;
  pet_addendum_received: boolean;
  has_insurance: boolean;
  insurance_verified: boolean;
  insurance_upload_pending: boolean;
  add_insurance_to_rent: boolean;
  has_vehicle: boolean;
  vehicle_verified: boolean;
  vehicle_addendum_received: boolean;
  permit_issued: boolean;
  tenant_picked_up: boolean;
  merged_into: string | null;
  created_at: string;
  [key: string]: any;
}

interface UnifiedTenant {
  key: string;
  name: string;
  unit_number: string;
  building_address: string;
  phone: string | null;
  email: string | null;
  hasSubmission: boolean;
  submissionData: Submission | null;
  tenantLookupId: string | null;
  move_in: string | null;
  is_current: boolean;
  unitSubmissionCount: number;
  canonicalSubmissionId: string | null;
  canonicalSelectionRequired: boolean;
  unitSubmissionCandidates: Array<{
    id: string;
    full_name: string;
    created_at: string;
    phone: string | null;
    email: string | null;
    has_vehicle: boolean;
    has_pets: boolean;
    has_insurance: boolean;
    is_primary: boolean;
  }>;
}

function normalizeForMatching(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function normalizeNameForKey(name: string | null | undefined): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[,.']/g, '')
    .split(/\s+/)
    .filter(p => p.length > 0)
    .sort()
    .join(' ');
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: tenantLookupData, error: lookupError } = await supabase
      .from('tenant_lookup')
      .select('*')
      .order('building_address', { ascending: true })
      .order('unit_number', { ascending: true });

    if (lookupError) {
      console.error('Error fetching tenant_lookup:', lookupError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch tenant data' },
        { status: 500 }
      );
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .is('merged_into', null)
      .order('building_address', { ascending: true })
      .order('unit_number', { ascending: true });

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    const tenantLookup = ((tenantLookupData || []) as TenantLookupRecord[])
      .filter(t => t.name !== 'Occupied Unit');
    const submissions = (submissionsData || []) as Submission[];

    const submissionsByUnit = new Map<string, Submission[]>();
    for (const submission of submissions) {
      const unitKey = `${normalizeAddress(submission.building_address).toLowerCase()}_${normalizeForMatching(submission.unit_number)}`;
      const existing = submissionsByUnit.get(unitKey) || [];
      existing.push(submission);
      submissionsByUnit.set(unitKey, existing);
    }

    const canonicalByUnit = new Map<string, {
      canonicalSubmission: Submission | null;
      canonicalSelectionRequired: boolean;
      candidates: Submission[];
    }>();

    for (const [unitKey, unitSubs] of submissionsByUnit.entries()) {
      const sorted = [...unitSubs].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const primarySubs = sorted.filter(s => s.is_primary === true);
      const canonicalSelectionRequired = sorted.length > 1 && primarySubs.length !== 1;
      const canonicalSubmission =
        sorted.length === 1
          ? sorted[0]
          : primarySubs.length === 1
            ? primarySubs[0]
            : null;

      canonicalByUnit.set(unitKey, {
        canonicalSubmission,
        canonicalSelectionRequired,
        candidates: sorted,
      });
    }

    // Use a Map to deduplicate tenants with matching normalized keys
    const tenantMap = new Map<string, UnifiedTenant>();
    const processedUnitKeys = new Set<string>();

    // Process tenant_lookup records
    for (const tenant of tenantLookup) {
      const normalizedAddr = normalizeAddress(tenant.building_address).toLowerCase();
      const unitKey = `${normalizedAddr}_${normalizeForMatching(tenant.unit_number)}`;
      const unitResolution = canonicalByUnit.get(unitKey);
      const matchingSubmission = unitResolution?.canonicalSubmission || null;

      if (unitResolution) {
        processedUnitKeys.add(unitKey);
      }

      // Use normalized address in key to merge duplicates
      const key = `${normalizedAddr}_${normalizeForMatching(tenant.unit_number)}_${normalizeNameForKey(tenant.name)}`;

      // If this key already exists, prefer the record with a submission
      const existing = tenantMap.get(key);
      if (existing && !matchingSubmission && existing.hasSubmission) {
        // Skip this duplicate - keep the one with submission
        continue;
      }

      tenantMap.set(key, {
        key,
        name: tenant.name,
        unit_number: tenant.unit_number,
        building_address: normalizeAddress(tenant.building_address),
        phone: matchingSubmission?.phone || tenant.phone,
        email: matchingSubmission?.email || tenant.email,
        hasSubmission: !!matchingSubmission,
        submissionData: matchingSubmission || null,
        tenantLookupId: tenant.id,
        move_in: tenant.move_in,
        is_current: tenant.is_current,
        unitSubmissionCount: unitResolution?.candidates.length || 0,
        canonicalSubmissionId: unitResolution?.canonicalSubmission?.id || null,
        canonicalSelectionRequired: unitResolution?.canonicalSelectionRequired || false,
        unitSubmissionCandidates: (unitResolution?.candidates || []).map((candidate) => ({
          id: candidate.id,
          full_name: candidate.full_name,
          created_at: candidate.created_at,
          phone: candidate.phone || null,
          email: candidate.email || null,
          has_vehicle: !!candidate.has_vehicle,
          has_pets: !!candidate.has_pets,
          has_insurance: !!candidate.has_insurance,
          is_primary: candidate.is_primary === true,
        })),
      });
    }

    // Process unmatched unit-level canonical submissions
    for (const [unitKey, unitResolution] of canonicalByUnit.entries()) {
      if (processedUnitKeys.has(unitKey)) continue;

      const canonicalSubmission = unitResolution.canonicalSubmission;
      const fallbackSubmission = unitResolution.candidates[0] || null;
      const displaySubmission = canonicalSubmission || fallbackSubmission;
      if (!displaySubmission) continue;

      const key = `${normalizeAddress(displaySubmission.building_address).toLowerCase()}_${normalizeForMatching(displaySubmission.unit_number)}_${normalizeNameForKey(displaySubmission.full_name)}`;

      if (!tenantMap.has(key)) {
        tenantMap.set(key, {
          key,
          name: displaySubmission.full_name,
          unit_number: displaySubmission.unit_number,
          building_address: normalizeAddress(displaySubmission.building_address),
          phone: displaySubmission.phone || null,
          email: displaySubmission.email || null,
          hasSubmission: !!canonicalSubmission,
          submissionData: canonicalSubmission,
          tenantLookupId: null,
          move_in: null,
          is_current: true,
          unitSubmissionCount: unitResolution.candidates.length,
          canonicalSubmissionId: canonicalSubmission?.id || null,
          canonicalSelectionRequired: unitResolution.canonicalSelectionRequired,
          unitSubmissionCandidates: unitResolution.candidates.map((candidate) => ({
            id: candidate.id,
            full_name: candidate.full_name,
            created_at: candidate.created_at,
            phone: candidate.phone || null,
            email: candidate.email || null,
            has_vehicle: !!candidate.has_vehicle,
            has_pets: !!candidate.has_pets,
            has_insurance: !!candidate.has_insurance,
            is_primary: candidate.is_primary === true,
          })),
        });
      }
    }

    const unifiedTenants = Array.from(tenantMap.values());

    return NextResponse.json({
      success: true,
      data: unifiedTenants,
      stats: {
        total_tenants: unifiedTenants.length,
        with_submissions: unifiedTenants.filter(t => t.hasSubmission).length,
        without_submissions: unifiedTenants.filter(t => !t.hasSubmission).length,
      },
    });

  } catch (error: any) {
    console.error('Unified tenants fetch error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch unified tenant data' },
      { status: 500 }
    );
  }
}
