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

function tenantsMatch(
  building1: string,
  unit1: string,
  name1: string,
  building2: string,
  unit2: string,
  name2: string
): boolean {
  // Use enhanced address normalization to handle city/state/zip variations and building aliases
  const normalizedBuilding1 = normalizeAddress(building1).toLowerCase();
  const normalizedBuilding2 = normalizeAddress(building2).toLowerCase();
  const buildingMatch = normalizedBuilding1 === normalizedBuilding2;
  
  const unitMatch = normalizeForMatching(unit1) === normalizeForMatching(unit2);
  const nameMatch = normalizeForMatching(name1) === normalizeForMatching(name2) ||
                    normalizeNameForKey(name1) === normalizeNameForKey(name2);
  
  return buildingMatch && unitMatch && nameMatch;
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

    // Use a Map to deduplicate tenants with matching normalized keys
    const tenantMap = new Map<string, UnifiedTenant>();
    const processedSubmissions = new Set<string>();

    // Process tenant_lookup records
    for (const tenant of tenantLookup) {
      const matchingSubmission = submissions.find(sub => 
        tenantsMatch(
          tenant.building_address,
          tenant.unit_number,
          tenant.name,
          sub.building_address,
          sub.unit_number,
          sub.full_name
        )
      );

      if (matchingSubmission) {
        processedSubmissions.add(matchingSubmission.id);
      }

      // Use normalized address in key to merge duplicates
      const normalizedAddr = normalizeAddress(tenant.building_address).toLowerCase();
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
      });
    }

    // Process unmatched submissions
    for (const submission of submissions) {
      if (!processedSubmissions.has(submission.id)) {
        const normalizedAddr = normalizeAddress(submission.building_address).toLowerCase();
        const key = `${normalizedAddr}_${normalizeForMatching(submission.unit_number)}_${normalizeNameForKey(submission.full_name)}`;

        // Check if this submission matches an existing tenant (edge case)
        if (!tenantMap.has(key)) {
          tenantMap.set(key, {
            key,
            name: submission.full_name,
            unit_number: submission.unit_number,
            building_address: normalizeAddress(submission.building_address),
            phone: submission.phone,
            email: submission.email,
            hasSubmission: true,
            submissionData: submission,
            tenantLookupId: null,
            move_in: null,
            is_current: true,
          });
        }
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
