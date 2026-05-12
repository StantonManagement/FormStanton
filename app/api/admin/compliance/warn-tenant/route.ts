import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';
import { createTenantIssue } from '@/lib/tenantIssues';

/**
 * POST /api/admin/compliance/warn-tenant
 * Mark a tenant as warned about parking (pre-tow state).
 * This is the intermediate state between "not on list" and "on tow list".
 * 
 * Body: { 
 *   submissionId: string,
 *   notes?: string // optional notes about the warning
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, notes } = body;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || 'Admin';

    // Get submission details
    const { data: submission } = await supabaseAdmin
      .from('submissions')
      .select('full_name, unit_number, building_address, parking_warned_at')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    // Check if already warned
    if (submission.parking_warned_at) {
      return NextResponse.json(
        { success: false, message: 'Tenant is already in warned state' },
        { status: 400 }
      );
    }

    // Update the submission with warning info
    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update({
        parking_warned_at: new Date().toISOString(),
        parking_warned_by: by,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('warn-tenant error:', error);
      return NextResponse.json({ success: false, message: 'Failed to warn tenant' }, { status: 500 });
    }

    // Log to audit trail
    await logAudit(
      sessionUser,
      'parking.warning_issued',
      'submission',
      submissionId,
      { 
        by,
        notes: notes ? String(notes).trim() : null
      },
      getClientIp(request),
    );

    // Write to tenant issues for scoring
    await createTenantIssue({
      tenant_name: submission.full_name || 'Unknown',
      unit_number: submission.unit_number,
      building_address: submission.building_address,
      issue_type: 'parking_warning',
      issue_date: new Date().toISOString(),
      reference_type: 'submission',
      reference_id: submissionId,
      severity: 2, // Lower severity for warning (escalation step)
      notes: notes ? `Parking warning issued: ${String(notes).trim()}` : 'Parking warning issued (pre-tow state)',
      created_by: by,
    });

    return NextResponse.json({ 
      success: true, 
      data,
      warnedAt: data.parking_warned_at,
      warnedBy: data.parking_warned_by
    });
  } catch (error: any) {
    console.error('warn-tenant exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to warn tenant' },
      { status: 500 }
    );
  }
}
