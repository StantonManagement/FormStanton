import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { normalizeAddress } from '@/lib/addressNormalizer';

function normalizeForMatching(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { building_address, unit_number, canonical_submission_id } = body || {};

    if (!building_address || !unit_number || !canonical_submission_id) {
      return NextResponse.json(
        { success: false, message: 'building_address, unit_number, and canonical_submission_id are required' },
        { status: 400 }
      );
    }

    const normalizedBuilding = normalizeAddress(building_address).toLowerCase();
    const normalizedUnit = normalizeForMatching(unit_number);

    const { data: unitCandidates, error: candidatesError } = await supabaseAdmin
      .from('submissions')
      .select('id, building_address, unit_number, full_name, created_at, is_primary, merged_into')
      .is('merged_into', null)
      .ilike('unit_number', unit_number.trim())
      .order('created_at', { ascending: false });

    if (candidatesError) {
      console.error('Failed to fetch canonical candidates:', candidatesError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch submission candidates' },
        { status: 500 }
      );
    }

    const scopedCandidates = (unitCandidates || []).filter((candidate) => {
      const candidateBuilding = normalizeAddress(candidate.building_address).toLowerCase();
      const candidateUnit = normalizeForMatching(candidate.unit_number);
      return candidateBuilding === normalizedBuilding && candidateUnit === normalizedUnit;
    });

    if (scopedCandidates.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Canonical selection requires at least two active submissions in this unit' },
        { status: 400 }
      );
    }

    const canonicalCandidate = scopedCandidates.find((candidate) => candidate.id === canonical_submission_id);
    if (!canonicalCandidate) {
      return NextResponse.json(
        { success: false, message: 'Selected canonical submission is not valid for this unit' },
        { status: 400 }
      );
    }

    const candidateIds = scopedCandidates.map((candidate) => candidate.id);

    const { error: clearPrimaryError } = await supabaseAdmin
      .from('submissions')
      .update({ is_primary: false })
      .in('id', candidateIds);

    if (clearPrimaryError) {
      console.error('Failed to clear existing primary flags:', clearPrimaryError);
      return NextResponse.json(
        { success: false, message: 'Failed to clear existing canonical selection' },
        { status: 500 }
      );
    }

    const { data: canonicalUpdated, error: canonicalError } = await supabaseAdmin
      .from('submissions')
      .update({ is_primary: true })
      .eq('id', canonical_submission_id)
      .select('*')
      .single();

    if (canonicalError) {
      console.error('Failed to set canonical submission:', canonicalError);
      return NextResponse.json(
        { success: false, message: 'Failed to set canonical submission' },
        { status: 500 }
      );
    }

    const sessionUser = await getSessionUser();
    await logAudit(
      sessionUser,
      'lobby.canonical_selected',
      'submission',
      canonical_submission_id,
      {
        building_address,
        unit_number,
        candidate_ids: candidateIds,
      },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      canonical_submission_id,
      submissionData: canonicalUpdated,
    });
  } catch (error: any) {
    console.error('Lobby canonical selection error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to set canonical submission' },
      { status: 500 }
    );
  }
}
