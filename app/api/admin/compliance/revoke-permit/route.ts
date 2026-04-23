import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

const VALID_REASONS = ['moved_out', 'nonpayment', 'lost', 'other'] as const;
type RevokeReason = typeof VALID_REASONS[number];

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, reason, notes, undo } = body;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || body.by || 'Admin';
    const isUndo = undo === true;

    if (!isUndo) {
      if (!reason || !VALID_REASONS.includes(reason as RevokeReason)) {
        return NextResponse.json(
          { success: false, message: 'Valid reason required (moved_out, nonpayment, lost, other)' },
          { status: 400 }
        );
      }
      if (reason === 'other' && (!notes || !String(notes).trim())) {
        return NextResponse.json(
          { success: false, message: 'Notes are required when reason is "other"' },
          { status: 400 }
        );
      }
    }

    // Determine tow_flagged: true if revoked AND vehicle_plate exists AND not already towed
    let updateData: Record<string, any>;
    if (isUndo) {
      updateData = {
        permit_revoked: false,
        permit_revoked_at: null,
        permit_revoked_by: null,
        permit_revoked_reason: null,
        permit_revoked_notes: null,
        tow_flagged: false,
      };
    } else {
      const { data: existing } = await supabaseAdmin
        .from('submissions')
        .select('vehicle_plate, towed_at')
        .eq('id', submissionId)
        .single();
      const hasPlate = !!(existing?.vehicle_plate && String(existing.vehicle_plate).trim());
      const notYetTowed = !existing?.towed_at;
      updateData = {
        permit_revoked: true,
        permit_revoked_at: new Date().toISOString(),
        permit_revoked_by: by,
        permit_revoked_reason: reason,
        permit_revoked_notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        tow_flagged: hasPlate && notYetTowed,
      };
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('revoke-permit error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update revoke status' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      isUndo ? 'permit.revoked_undo' : 'permit.revoked',
      'submission',
      submissionId,
      { by, reason: isUndo ? null : reason, notes: isUndo ? null : notes, undo: isUndo },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('revoke-permit exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to revoke permit' },
      { status: 500 }
    );
  }
}
