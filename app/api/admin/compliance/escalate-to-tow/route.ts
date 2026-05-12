import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';
import { createTenantIssue, findExistingIssue } from '@/lib/tenantIssues';

const VALID_REASONS = ['moved_out', 'vehicle_sold', 'violation', 'parking_non_payment', 'other'] as const;
type TowReason = typeof VALID_REASONS[number];

/**
 * POST /api/admin/compliance/escalate-to-tow
 * Escalate a warned tenant to the tow list.
 * This is the transition from "warned" state to "tow list" state.
 * 
 * Body: { 
 *   submissionId: string,
 *   reason: 'moved_out' | 'vehicle_sold' | 'violation' | 'parking_non_payment' | 'other',
 *   notes?: string
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, reason, notes } = body;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    if (!reason || !VALID_REASONS.includes(reason as TowReason)) {
      return NextResponse.json(
        { success: false, message: 'Valid reason required (moved_out, vehicle_sold, violation, parking_non_payment, or other)' },
        { status: 400 }
      );
    }

    // 'other' reason requires notes
    if (reason === 'other' && (!notes || !String(notes).trim())) {
      return NextResponse.json(
        { success: false, message: 'Notes are required when reason is "other"' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || 'Admin';

    // Get submission details
    const { data: submission } = await supabaseAdmin
      .from('submissions')
      .select('full_name, unit_number, building_address, vehicle_plate, parking_warned_at, tow_flagged, towed_at')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    // Check if already on tow list or towed
    if (submission.tow_flagged && !submission.towed_at) {
      return NextResponse.json(
        { success: false, message: 'Vehicle is already on tow list' },
        { status: 400 }
      );
    }

    if (submission.towed_at) {
      return NextResponse.json(
        { success: false, message: 'Vehicle has already been marked as towed' },
        { status: 400 }
      );
    }

    // Check if there's a plate on file (required for tow list)
    if (!submission.vehicle_plate || !String(submission.vehicle_plate).trim()) {
      return NextResponse.json(
        { success: false, message: 'Cannot add to tow list without a vehicle plate on file' },
        { status: 400 }
      );
    }

    // Update the submission - promote to tow list
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update({
        tow_flagged: true,
        permit_revoked: true,
        permit_revoked_at: new Date().toISOString(),
        permit_revoked_by: by,
        permit_revoked_reason: reason,
        permit_revoked_notes: notes ? String(notes).trim() : null,
        // Clear the warning state since it's now escalated
        parking_warned_at: null,
        parking_warned_by: null,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('escalate-to-tow error:', error);
      return NextResponse.json({ success: false, message: 'Failed to escalate to tow list' }, { status: 500 });
    }

    // Log to audit trail
    await logAudit(
      sessionUser,
      'tow.escalated_from_warning',
      'submission',
      submissionId,
      { 
        by,
        reason,
        notes: notes ? String(notes).trim() : null,
        priorWarningAt: submission.parking_warned_at
      },
      getClientIp(request),
    );

    // Write to tenant issues for scoring
    const issueType = reason === 'parking_non_payment' ? 'parking_tow_listed' : 'parking_delinquency';
    const severity = reason === 'parking_non_payment' ? 4 : 3;
    
    const existing = await findExistingIssue('submission', submissionId, issueType);
    if (existing.success && (!existing.data || existing.data.length === 0)) {
      await createTenantIssue({
        tenant_name: submission.full_name || 'Unknown',
        unit_number: submission.unit_number,
        building_address: submission.building_address,
        issue_type: issueType,
        issue_date: new Date().toISOString(),
        reference_type: 'submission',
        reference_id: submissionId,
        severity,
        notes: `Escalated from warning to tow list. Reason: ${reason}${notes ? `. Notes: ${String(notes).trim()}` : ''}`,
        created_by: by,
      });
    }

    return NextResponse.json({ 
      success: true, 
      data,
      reason,
      escalatedAt: data.permit_revoked_at
    });
  } catch (error: any) {
    console.error('escalate-to-tow exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to escalate to tow list' },
      { status: 500 }
    );
  }
}
