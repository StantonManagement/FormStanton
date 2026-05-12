import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';
import { createTenantIssue, findExistingIssue } from '@/lib/tenantIssues';

const VALID_REASONS = ['moved_out', 'vehicle_sold', 'violation', 'parking_non_payment', 'other'] as const;
type TowReason = typeof VALID_REASONS[number];

/**
 * POST /api/admin/compliance/edit-tow-reason
 * Edit the reason for a vehicle being on the tow list.
 * Preserves edit history in tow_reason_history table.
 * 
 * Body: { 
 *   submissionId: string,
 *   reason: 'moved_out' | 'vehicle_sold' | 'violation' | 'parking_non_payment' | 'other',
 *   notes?: string,
 *   context?: string // optional context for why edit was made
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, reason, notes, context } = body;

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

    // Get current values for history
    const { data: currentSubmission } = await supabaseAdmin
      .from('submissions')
      .select('permit_revoked_reason, permit_revoked_notes, full_name, unit_number, building_address')
      .eq('id', submissionId)
      .single();

    if (!currentSubmission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    const priorReason = currentSubmission.permit_revoked_reason;
    const priorNotes = currentSubmission.permit_revoked_notes;
    const newReason = reason;
    const newNotes = notes ? String(notes).trim() : null;

    // Write to history before updating
    const { error: historyError } = await supabaseAdmin
      .from('tow_reason_history')
      .insert({
        submission_id: submissionId,
        prior_reason: priorReason,
        prior_notes: priorNotes,
        new_reason: newReason,
        new_notes: newNotes,
        edited_by: by,
        edit_context: context ? String(context).trim() : null,
      });

    if (historyError) {
      console.error('edit-tow-reason history error:', historyError);
      // Continue with update even if history fails - don't block the operation
    }

    // Update the submission
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update({
        permit_revoked_reason: newReason,
        permit_revoked_notes: newNotes,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('edit-tow-reason error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update tow reason' }, { status: 500 });
    }

    // Log to audit trail
    await logAudit(
      sessionUser,
      'tow.reason_edited',
      'submission',
      submissionId,
      { 
        by,
        priorReason,
        newReason,
        priorNotes,
        newNotes,
        context: context || null
      },
      getClientIp(request),
    );

    // If reason is parking_non_payment, ensure tenant issue exists for scoring
    if (newReason === 'parking_non_payment') {
      const existing = await findExistingIssue('submission', submissionId, 'parking_tow_listed');
      if (existing.success && (!existing.data || existing.data.length === 0)) {
        await createTenantIssue({
          tenant_name: currentSubmission.full_name || 'Unknown',
          unit_number: currentSubmission.unit_number,
          building_address: currentSubmission.building_address,
          issue_type: 'parking_tow_listed',
          issue_date: new Date().toISOString(),
          reference_type: 'submission',
          reference_id: submissionId,
          severity: 4, // Higher severity for non-payment
          notes: `Vehicle added to tow list for parking non-payment${newNotes ? `: ${newNotes}` : ''}`,
          created_by: by,
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      data,
      priorReason,
      newReason
    });
  } catch (error: any) {
    console.error('edit-tow-reason exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update tow reason' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/compliance/edit-tow-reason?submissionId=xxx
 * Get the edit history for a submission's tow reason.
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const submissionId = request.nextUrl.searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tow_reason_history')
      .select('*')
      .eq('submission_id', submissionId)
      .order('edited_at', { ascending: false });

    if (error) {
      console.error('edit-tow-reason GET error:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch reason history' }, { status: 500 });
    }

    return NextResponse.json({ success: true, history: data || [] });
  } catch (error: any) {
    console.error('edit-tow-reason GET exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch reason history' },
      { status: 500 }
    );
  }
}
