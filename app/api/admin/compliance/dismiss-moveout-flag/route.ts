import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';
import { createTenantIssue } from '@/lib/tenantIssues';

const VALID_DISMISSAL_TYPES = ['false_positive', 'decision_to_decline'] as const;
type DismissalType = typeof VALID_DISMISSAL_TYPES[number];

/**
 * POST /api/admin/compliance/dismiss-moveout-flag
 * Dismiss an auto-flagged move-out detection.
 * 
 * Body: { 
 *   submissionId: string,
 *   dismissalType: 'false_positive' | 'decision_to_decline',
 *   reason: string 
 * }
 * 
 * dismissalType:
 * - 'false_positive': Flag was wrong (data quality). May re-appear if AppFolio data changes.
 * - 'decision_to_decline': Flag was correct, but PM chose not to tow (policy decision). Feeds tenant scoring.
 */

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, dismissalType, reason } = body;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    if (!dismissalType || !VALID_DISMISSAL_TYPES.includes(dismissalType as DismissalType)) {
      return NextResponse.json(
        { success: false, message: 'Valid dismissal type required (false_positive or decision_to_decline)' },
        { status: 400 }
      );
    }

    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ success: false, message: 'Dismissal reason is required' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || 'Admin';

    // Get submission details for tenant issues (if decision_to_decline)
    const { data: submission } = await supabaseAdmin
      .from('submissions')
      .select('full_name, unit_number, building_address')
      .eq('id', submissionId)
      .single();

    // Update the submission with dismissal info
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update({
        moveout_flag_dismissed_at: new Date().toISOString(),
        moveout_flag_dismissed_by: by,
        moveout_flag_dismissed_reason: String(reason).trim(),
        moveout_flag_dismissal_type: dismissalType,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('dismiss-moveout-flag error:', error);
      return NextResponse.json({ success: false, message: 'Failed to dismiss move-out flag' }, { status: 500 });
    }

    // Log to audit trail
    await logAudit(
      sessionUser,
      'moveout_flag.dismissed',
      'submission',
      submissionId,
      { 
        by, 
        dismissalType, 
        reason: String(reason).trim(),
        feedsScoring: dismissalType === 'decision_to_decline'
      },
      getClientIp(request),
    );

    // If decision_to_decline, also write to tenant issues for scoring
    if (dismissalType === 'decision_to_decline' && submission) {
      await createTenantIssue({
        tenant_name: submission.full_name || 'Unknown',
        unit_number: submission.unit_number,
        building_address: submission.building_address,
        issue_type: 'parking_declined_tow',
        issue_date: new Date().toISOString(),
        reference_type: 'submission',
        reference_id: submissionId,
        severity: 3, // Moderate severity - PM declined to enforce
        notes: `Move-out flag dismissed (decision to decline): ${String(reason).trim()}`,
        created_by: by,
      });
    }

    return NextResponse.json({ 
      success: true, 
      data,
      dismissalType,
      feedsScoring: dismissalType === 'decision_to_decline'
    });
  } catch (error: any) {
    console.error('dismiss-moveout-flag exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to dismiss move-out flag' },
      { status: 500 }
    );
  }
}
