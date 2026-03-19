import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeAddress } from '@/lib/addressNormalizer';

function normalizeForMatching(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function resolveCanonicalSubmissionId(buildingAddress: string, unitNumber: string): Promise<{
  canonicalSubmissionId: string | null;
  canonicalSelectionRequired: boolean;
}> {
  const normalizedBuilding = normalizeAddress(buildingAddress).toLowerCase();
  const normalizedUnit = normalizeForMatching(unitNumber);

  const { data: candidates } = await supabaseAdmin
    .from('submissions')
    .select('id, building_address, unit_number, is_primary, merged_into, created_at')
    .is('merged_into', null)
    .ilike('unit_number', unitNumber.trim())
    .order('created_at', { ascending: false });

  const scopedCandidates = (candidates || []).filter((candidate) => {
    const candidateBuilding = normalizeAddress(candidate.building_address).toLowerCase();
    const candidateUnit = normalizeForMatching(candidate.unit_number);
    return candidateBuilding === normalizedBuilding && candidateUnit === normalizedUnit;
  });

  if (scopedCandidates.length === 0) {
    return { canonicalSubmissionId: null, canonicalSelectionRequired: false };
  }

  if (scopedCandidates.length === 1) {
    return { canonicalSubmissionId: scopedCandidates[0].id, canonicalSelectionRequired: false };
  }

  const primarySubs = scopedCandidates.filter((candidate) => candidate.is_primary === true);
  if (primarySubs.length === 1) {
    return { canonicalSubmissionId: primarySubs[0].id, canonicalSelectionRequired: false };
  }

  return { canonicalSubmissionId: null, canonicalSelectionRequired: true };
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const building = searchParams.get('building');
    const unit = searchParams.get('unit');

    if (!building || !unit) {
      return NextResponse.json(
        { success: false, message: 'Building address and unit number required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_insurance_policies')
      .select('*')
      .eq('building_address', building)
      .eq('unit_number', unit)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching insurance:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch insurance data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      policy: data && data.length > 0 ? data[0] : null,
    });
  } catch (error: any) {
    console.error('Insurance GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch insurance' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      tenant_name,
      building_address,
      unit_number,
      insurance_type,
      provider,
      policy_number,
      liability_coverage,
      policy_expiration,
      additional_insured_added,
      proof_received,
      has_pets,
      created_by,
    } = body;

    const hasAdditionalInsured = Object.prototype.hasOwnProperty.call(body, 'additional_insured_added');
    const hasProofReceived = Object.prototype.hasOwnProperty.call(body, 'proof_received');
    const hasHasPets = Object.prototype.hasOwnProperty.call(body, 'has_pets');
    const normalizedCoverage = Number(liability_coverage);

    if (!tenant_name || !building_address || !unit_number || !insurance_type || !created_by) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!hasAdditionalInsured || !hasProofReceived || !hasHasPets) {
      return NextResponse.json(
        { success: false, message: 'Missing required insurance confirmations' },
        { status: 400 }
      );
    }

    if (
      typeof additional_insured_added !== 'boolean' ||
      typeof proof_received !== 'boolean' ||
      typeof has_pets !== 'boolean'
    ) {
      return NextResponse.json(
        { success: false, message: 'Insurance confirmations must be true/false values' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(normalizedCoverage) || normalizedCoverage <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid liability coverage amount' },
        { status: 400 }
      );
    }

    if (has_pets && normalizedCoverage < 300000) {
      return NextResponse.json(
        { success: false, message: 'Pet households require at least $300,000 liability coverage' },
        { status: 400 }
      );
    }

    // Mark any existing current policy as not current
    await supabaseAdmin
      .from('tenant_insurance_policies')
      .update({ is_current: false })
      .eq('building_address', building_address)
      .eq('unit_number', unit_number)
      .eq('is_current', true);

    // Insert new policy
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('tenant_insurance_policies')
      .insert({
        tenant_name,
        building_address,
        unit_number,
        insurance_type,
        provider: provider || null,
        policy_number: policy_number || null,
        liability_coverage: normalizedCoverage,
        policy_expiration: policy_expiration || null,
        additional_insured_added,
        additional_insured_confirmed_at: additional_insured_added ? now : null,
        proof_received,
        proof_received_at: proof_received ? now : null,
        has_pets,
        is_current: true,
        created_by,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving insurance:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to save insurance policy' },
        { status: 500 }
      );
    }

    // Sync add_insurance_to_rent on the submissions table
    const isAppfolio = insurance_type === 'appfolio';
    const canonicalResolution = await resolveCanonicalSubmissionId(building_address, unit_number);
    if (canonicalResolution.canonicalSelectionRequired) {
      return NextResponse.json(
        {
          success: false,
          message: 'Canonical selection required before syncing insurance to submissions for this unit',
          canonicalSelectionRequired: true,
        },
        { status: 409 }
      );
    }

    if (canonicalResolution.canonicalSubmissionId) {
      await supabaseAdmin
        .from('submissions')
        .update({ add_insurance_to_rent: isAppfolio })
        .eq('id', canonicalResolution.canonicalSubmissionId);
    }

    return NextResponse.json({ success: true, policy: data });
  } catch (error: any) {
    console.error('Insurance POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save insurance' },
      { status: 500 }
    );
  }
}
